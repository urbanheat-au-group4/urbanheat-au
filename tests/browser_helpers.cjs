// Shared helpers for the national dashboard browser tests.

// On desktop the "Location details" card is a pop-up that stays closed until
// someone opens it. Closed details hide their text from innerText, so tests
// that read #detail or the monthly chart open it first.
// It must be opened with a real click on its heading, the way a visitor does it.
async function openLocationCard(page) {
  const card = page.locator('#location-card');
  if (!(await card.evaluate(node => node.open))) {
    await card.locator('summary').first().click();
  }
}

// Historical and Compare are separate tabs. Click the tab like a visitor would.
async function openTab(page, name) {
  await page.locator('#tab-' + name).click();
  await page.locator('#panel-' + name).waitFor({state: 'visible'});
}

// The older single-location charts sit inside a "More detail" bar on each tab.
async function openMoreDetail(page, id) {
  const bar = page.locator('#' + id);
  if (!(await bar.evaluate(node => node.open))) {
    await bar.locator('summary').first().click();
  }
}

module.exports = {openLocationCard, openTab, openMoreDetail};
