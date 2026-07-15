# One Curve, Fifty Outbreaks

An interactive D3 narrative visualization showing how reported
COVID-19 hotspots moved across the United States between
January 2020 and March 2023.

## Public visualization

[View the interactive narrative visualization](https://jonlowek.github.io/covid-narrative-visualization/)

## Message

The national COVID-19 curve hides a changing geography.

The first major outbreak was concentrated in the Northeast, the
summer 2020 hotspot shifted south and west, and by January 2022
nearly every state was experiencing a high reported case rate at
the same time.

## Narrative structure

The visualization follows an **interactive slideshow** structure.

The viewer proceeds through four author-defined scenes using the
Previous and Next buttons or the numbered scene controls. Individual
scenes also provide details-on-demand and structured exploration
without requiring the viewer to leave the narrative sequence.

## Scenes

### Scene 1 — The national curve

Introduces the full national timeline and establishes the central
question: where were the reported cases producing each national wave?

A persistent annotation identifies the largest national peak.

### Scene 2 — The first wave

Displays the state-level geographic pattern on April 10, 2020.

The annotation highlights the concentration in New York and the
Northeast while most states had much lower reported case rates.

### Scene 3 — The hotspot moved

Displays the geographic pattern on July 25, 2020.

A comparison control allows the viewer to switch between April 10
and July 25 while remaining inside the scene. The map, timeline
marker, narrative description, and annotations update together.

### Scene 4 — The broadest wave

Displays the widespread January 14, 2022 surge.

This scene permits broader exploration through:

- A date slider covering the complete dataset
- A state dropdown
- Clickable map states
- A state-versus-national timeline comparison
- Dynamic annotations and rankings
- A reset control

## Scenes, annotations, parameters, and triggers

### Scenes

The four scenes use the same visual platform:

- Narrative panel
- National timeline
- State choropleth map
- Fixed color legend
- Progress controls
- Previous and Next navigation

Maintaining this structure helps preserve visual continuity when
dates, map colors, annotations, and selected states change.

### Annotations

Persistent SVG callouts identify important evidence directly within
the charts. They use a consistent template consisting of:

- A circular anchor
- A connector line
- A white callout box
- A bold heading
- Concise supporting evidence

Tooltips are separate details-on-demand and do not replace the
persistent annotations.

### Parameters

Important JavaScript state variables include:

- `currentSceneIndex`
- `selectedDate`
- `selectedState`
- `hoveredState`
- `comparisonDate`
- `explorationEnabled`
- `isTransitioning`

Together, these parameters define the current state of the narrative
visualization.

### Triggers

Examples of triggers include:

- Clicking Next or Previous changes `currentSceneIndex`.
- Clicking a numbered scene control loads that scene.
- Clicking April 10 or July 25 changes the comparison date in Scene 3.
- Moving the Scene 4 slider changes `selectedDate`.
- Selecting or clicking a state changes `selectedState`.
- Hovering over the timeline or map displays details-on-demand.
- Clicking Reset restores the January 14, 2022 scene state.
- Resizing the browser redraws both charts responsively.

## Visual encodings

### National timeline

- Horizontal position: date
- Vertical position: seven-day average reported cases per 100,000
- Dark red line: national rate
- Blue line: selected state rate
- Dashed vertical marker: date selected by the current scene
- Shaded area: magnitude of the national rate

### State map

State fill represents the seven-day average of newly reported cases
per 100,000 residents.

The same fixed thresholds are used in every scene:

| Color category | Reported cases per 100,000 |
|---|---:|
| Level 1 | Under 10 |
| Level 2 | 10–25 |
| Level 3 | 25–50 |
| Level 4 | 50–100 |
| Level 5 | 100–200 |
| Level 6 | Above 200 |

Using fixed thresholds ensures that the same color represents the same
rate across all dates.

## Data

COVID-19 data comes from:

- [The New York Times COVID-19 Data Repository](https://github.com/nytimes/covid-19-data)
- `rolling-averages/us.csv`
- `rolling-averages/us-states.csv`

The project uses:

- Seven-day average reported cases
- Seven-day average cases per 100,000
- Seven-day average reported deaths
- Seven-day average deaths per 100,000
- The 50 states and the District of Columbia
- January 21, 2020 through March 23, 2023

The original source files are downloaded into `data/raw/` and are
excluded from Git. The reproducible preprocessing script creates the
smaller files used by the webpage.

The source state file begins jurisdictions on different dates. The
preprocessing script fills only the leading dates before each
jurisdiction's first source record with zero. It does not fill or alter
gaps after a jurisdiction's first reported record.

The resulting state dataset contains:

- 1,158 dates
- 51 jurisdictions
- 59,058 state-date records
- Zero incomplete state-date combinations

## Geographic boundaries

State boundaries come from
[us-atlas](https://github.com/topojson/us-atlas), which is derived
from U.S. Census Bureau cartographic boundary files.

The corresponding us-atlas license is stored in:

```text
data/us-atlas-LICENSE.txt
```

## Limitations

The visualization represents **reported cases**, not every infection.

Testing availability, reporting policies, probable-case definitions,
reporting delays, and retrospective revisions changed during the
pandemic. State-level comparisons should therefore be interpreted as
comparisons of reported case rates rather than complete measurements
of infections.

The national New York Times series may include U.S. territories,
while the map displays the 50 states and the District of Columbia.

## Technology

- HTML
- CSS
- JavaScript
- D3.js 7.9.0
- TopoJSON Client 3.1.0
- Python 3 preprocessing
- GitHub Pages

No high-level visualization framework is used.

## Repository structure

```text
covid-narrative-visualization/
├── index.html
├── README.md
├── .gitignore
├── .nojekyll
├── css/
│   └── styles.css
├── js/
│   └── visualization.js
├── data/
│   ├── metadata.json
│   ├── states-10m.json
│   ├── states-rolling.csv
│   ├── us-atlas-LICENSE.txt
│   └── us-rolling.csv
└── scripts/
    └── prepare_data.py
```

## Running locally

Clone the repository and enter its directory:

```powershell
git clone https://github.com/jonlowek/covid-narrative-visualization.git
cd covid-narrative-visualization
```

Start a local HTTP server:

```powershell
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Opening `index.html` directly through a `file://` URL is not
recommended because browser security restrictions can prevent D3
from loading CSV and JSON files.

## Recreating the processed datasets

Download the original New York Times rolling-average files into:

```text
data/raw/us.csv
data/raw/us-states.csv
```

Then run:

```powershell
python scripts/prepare_data.py
```

The script validates the source data and recreates:

```text
data/us-rolling.csv
data/states-rolling.csv
data/metadata.json
```

## Attribution

Data © The New York Times Company.

This visualization is an educational, non-commercial derivative work
created for the University of Illinois Urbana-Champaign CS 416
Narrative Visualization assignment.