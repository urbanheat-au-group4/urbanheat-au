// Compare Locations section.
// Reads the yearly and seasonal data files, lets the user pick two or three locations and shows
// them side by side. The calculations are in compare_core.js, which must load first.
(function () {
  'use strict';

  const core = window.CompareCore;
  const selects = [1, 2, 3].map(n => document.getElementById('compare-' + n));
  const statusBox = document.getElementById('compare-status');
  const notesBox = document.getElementById('compare-notes');
  const tableBox = document.getElementById('compare-table');
  const sourceBox = document.getElementById('compare-source');
  if (!core || selects.some(select => !select) || !statusBox || !notesBox || !tableBox || !sourceBox) return;

  let records = [];
  let meta = null;

  function showMessage(text) {
    statusBox.textContent = text;
    notesBox.replaceChildren();
    tableBox.replaceChildren();
  }

  function makeOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  // A location already chosen in another box is switched off, so the same one cannot be picked twice.
  function refreshOptions() {
    const chosen = selects.map(select => select.value);
    selects.forEach((select, index) => {
      Array.from(select.options).forEach(option => {
        option.disabled = option.value !== '' &&
          chosen.some((id, other) => other !== index && id === option.value);
      });
    });
  }

  function makeCell(row, index, firstName) {
    const cell = document.createElement('td');
    const text = core.formatNumber(row.values[index], row.decimals);
    if (text === null) {
      cell.textContent = 'No data';
      cell.className = 'compare-na';
      return cell;
    }
    cell.textContent = text + ' ' + row.unit;
    const difference = core.formatDifference(row.differences[index], row.decimals, row.unit);
    if (difference) {
      const small = document.createElement('small');
      small.textContent = difference === 'same' ? 'same as ' + firstName : difference + ' compared with ' + firstName;
      cell.append(small);
    }
    return cell;
  }

  function drawTable(result) {
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = 'Climate comparison: ' + result.records.map(record => record.name).join(', ');
    table.append(caption);

    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.textContent = 'Measure';
    headRow.append(corner);
    result.records.forEach((record, index) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = record.name + ' (' + record.state + ')';
      if (index === 0) {
        const small = document.createElement('small');
        small.textContent = 'Comparison base';
        th.append(document.createElement('br'), small);
      }
      headRow.append(th);
    });
    const head = document.createElement('thead');
    head.append(headRow);
    table.append(head);

    const body = document.createElement('tbody');
    const firstName = result.records[0].name;
    result.rows.forEach(row => {
      const tr = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = row.label;
      tr.append(label);
      result.records.forEach((record, index) => tr.append(makeCell(row, index, firstName)));
      body.append(tr);
    });
    table.append(body);
    tableBox.replaceChildren(table);
  }

  function drawNotes(notes) {
    notesBox.replaceChildren();
    notes.forEach(note => {
      const p = document.createElement('p');
      p.className = 'compare-note compare-note-' + note.type;
      p.textContent = note.text;
      notesBox.append(p);
    });
  }

  function render() {
    // If the same location is somehow chosen twice, the later box is cleared.
    const ids = selects.map(select => select.value);
    selects.forEach((select, index) => {
      if (select.value && ids.indexOf(select.value) < index) select.value = '';
    });
    refreshOptions();

    const picked = core.uniqueIds(selects.map(select => select.value))
      .map(id => records.find(record => record.id === id))
      .filter(Boolean);
    if (picked.length < core.MIN_LOCATIONS) {
      showMessage('Choose at least two locations to compare.');
      return;
    }
    const result = core.compare(picked, meta);
    statusBox.textContent = 'Comparing ' + result.records.map(record => record.name).join(', ') +
      '. Differences are shown compared with ' + result.records[0].name + '.';
    drawNotes(result.notes);
    drawTable(result);
  }

  function listFrom(data) {
    if (Array.isArray(data.locations)) return data.locations;
    if (Array.isArray(data.points)) return data.points;
    return Object.values(data).find(Array.isArray) || [];
  }

  // The second box starts on a Victorian location far enough from the first for the model to tell them apart.
  function chooseDefaults() {
    const first = records.find(record => record.id === 'melbourne-cbd') || records[0];
    const others = records.filter(record => record !== first);
    const second = others.find(record => record.state === first.state &&
      core.distanceKm(first, record) >= core.NEAR_KM) || others[0];
    selects[0].value = first.id;
    selects[1].value = second ? second.id : '';
  }

  async function load() {
    try {
      const [dataResponse, seasonsResponse] = await Promise.all([
        fetch('/static/national_data.json', { cache: 'no-store' }),
        fetch('/static/national_seasons.json', { cache: 'no-store' })
      ]);
      if (!dataResponse.ok || !seasonsResponse.ok) throw new Error('not found');
      const data = await dataResponse.json();
      const seasons = await seasonsResponse.json();
      if (!Array.isArray(seasons.locations)) throw new Error('invalid');
      const seasonById = new Map(seasons.locations.map(location => [location.id, location]));
      records = listFrom(data)
        .filter(point => point && seasonById.has(point.id) &&
          Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
        .map(point => core.buildRecord(point, seasonById.get(point.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (records.length < core.MIN_LOCATIONS) throw new Error('too few');
      meta = {
        dataStart: data.start_date, dataEnd: data.end_date,
        seasonsStart: seasons.start_date, seasonsEnd: seasons.end_date
      };
      sourceBox.textContent = 'Source: ' + (seasons.source || data.source) +
        (seasons.model ? ' (model: ' + seasons.model + ')' : '') + ', ' +
        seasons.start_date + ' to ' + seasons.end_date +
        '. The same period, units and model are used for every location. Values are modelled estimates, ' +
        'not weather station readings. Summer is December to February and winter is June to August.';
    } catch (error) {
      showMessage('Comparison data is unavailable right now. Please try again later.');
      return;
    }
    selects.forEach((select, index) => {
      select.replaceChildren(makeOption('', index < 2 ? 'Choose a location' : 'No third location'));
      records.forEach(record => select.append(makeOption(record.id, record.name + ' (' + record.state + ')')));
      select.addEventListener('change', render);
    });
    chooseDefaults();
    render();
  }

  load();
})();