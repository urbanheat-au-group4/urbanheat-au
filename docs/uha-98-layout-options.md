# UHA-98: Three layout ideas

I checked the national dashboard layout on desktop and phone. These are three simple layout sketches. They are not final screenshots.

## Option A: Map first

Desktop:
```text
+----------------+---------------------------+
| State          | National map              |
| Climate measure|                           |
| Location       |                           |
+----------------+---------------------------+
| Location details and monthly chart             |
| History | Seasons | Compare                  |
+------------------------------------------------+
```

Phone:
```text
+------------------+
| State / Measure  |
| Location         |
| National map     |
| Location details |
| History / Seasons|
| Compare          |
+------------------+
```

## Option B: Comparison first

Desktop:
```text
+------------------------------------------------+
| Location 1  | Location 2  | Comparison          |
+------------------------------------------------+
| State and climate controls                      |
| National map                                    |
+------------------------------------------------+
| History / Seasons                               |
+------------------------------------------------+
```

Phone: comparison locations first, then the map and charts. This puts too much work before exploring the map.

## Option C: Split view

Desktop:
```text
+-------------------------+----------------------+
| Map                     | Location details     |
|                         | Monthly temperatures |
+-------------------------+----------------------+
| History / Seasons / Compare                     |
+------------------------------------------------+
```

Phone: map and details stack into one column. This makes the map smaller on desktop.

## Choice: Option A with parts of C

I chose **map first** because the main purpose is to explore Australian locations. The state, measure and location controls stay beside the map on desktop and stack above it on phones. Location details and monthly highs are in one expandable section below the map. History, seasons and location comparison follow.

This matches the current layout work in UHA-99 and UHA-102 rather than asking Dale to rewrite the page a second time.

## How I checked the idea

- The national map is still the main page.
- State and location controls stay together.
- Users can open climate details and monthly highs without leaving the page.
- A phone can stack these sections instead of forcing sideways scrolling.
- UHA-104 checks the real layout at 390px, 768px and 1440px. These sketches do not replace browser checks.

Linked work: UHA-94, UHA-99, UHA-102, UHA-104.
