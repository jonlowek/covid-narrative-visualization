"use strict";

const DATA_PATHS = {
    nationalData: "data/us-rolling.csv",
    stateData: "data/states-rolling.csv",
    metadata: "data/metadata.json",
    stateTopology: "data/states-10m.json",
};

const parseDate = d3.utcParse("%Y-%m-%d");
const formatDateKey = d3.utcFormat("%Y-%m-%d");
const formatFullDate = d3.utcFormat("%B %-d, %Y");
const formatWholeNumber = d3.format(",.0f");
const formatRate = d3.format(",.2f");

const SCENE_DEFINITIONS = [
    {
        sceneIndex: 0,
        kicker: "The national picture",
        title: "The United States experienced several distinct waves",
        description:
            "The national curve summarizes the pandemic, but it cannot show where each wave was concentrated.",
        annotation:
            "The geography of the pandemic changed substantially even when the country was described using one national line.",
        selectedDateKey: null,
        comparisonDateKey: null,
        explorationEnabled: false,
        interactionGuidance:
            "Hover over the national curve for exact dates and reported case rates.",
    },
    {
        sceneIndex: 1,
        kicker: "The first wave",
        title: "In April 2020, the outbreak was not evenly national",
        description:
            "The earliest major outbreak was concentrated in the Northeast while most states still reported much lower rates.",
        annotation:
            "New York reported 50.77 cases per 100,000—more than five times the national rate. The median state reported only 3.81.",
        selectedDateKey: "2020-04-10",
        comparisonDateKey: null,
        explorationEnabled: false,
        interactionGuidance:
            "Hover over a state to see its rate, national comparison, and rank.",
    },
    {
        sceneIndex: 2,
        kicker: "A changing geography",
        title: "By summer, the highest reported rates had shifted south and west",
        description:
            "The geographic center of the outbreak changed rather than expanding uniformly from the first affected states.",
        annotation:
            "Florida had the highest reported rate, followed by Louisiana and Mississippi. Thirteen jurisdictions exceeded 25 cases per 100,000.",
        selectedDateKey: "2020-07-25",
        comparisonDateKey: "2020-04-10",
        explorationEnabled: false,
        interactionGuidance:
            "Hover over states to compare the July hotspot pattern with the national rate.",
    },
    {
        sceneIndex: 3,
        kicker: "The broadest wave",
        title: "By January 2022, nearly every state was surging together",
        description:
            "The largest national peak was not limited to a small cluster of states. High reported rates were widespread.",
        annotation:
            "All 50 states and the District of Columbia exceeded 50 reported cases per 100,000. Fifty of the 51 exceeded 100.",
        selectedDateKey: "2022-01-14",
        comparisonDateKey: null,
        explorationEnabled: true,
        interactionGuidance:
            "Move the date slider or select a state to investigate the full timeline.",
    },
];

const SCENE_THREE_COMPARISON_CONTENT = {
    "2020-04-10": {
        description:
            "This reference view shows the early concentration in the Northeast before the summer hotspot shifted south and west.",
        annotation:
            "New York reported 50.77 cases per 100,000, while the median state reported only 3.81. Just three jurisdictions exceeded 25.",
        interactionGuidance:
            "Select July 25 to see how the highest reported rates moved south and west.",
    },

    "2020-07-25": {
        description:
            "The geographic center of the outbreak changed rather than expanding uniformly from the first affected states.",
        annotation:
            "Florida had the highest reported rate, followed by Louisiana and Mississippi. Thirteen jurisdictions exceeded 25 cases per 100,000.",
        interactionGuidance:
            "Select April 10 to compare the summer pattern with the first major outbreak.",
    },
};

const visualizationState = {
    currentSceneIndex: 0,
    selectedDate: null,
    selectedState: null,
    hoveredState: null,
    comparisonDate: null,
    explorationEnabled: false,
    isTransitioning: false,
};

let visualizationData = null;

const applicationStatusSelection = d3.select(
    "#application-status"
);

const stateSelectionControl = d3.select(
    "#state-selection"
);

const stateSelectionGroupSelection = d3.select(
    "#state-selection-group"
);

const dateSliderControl = d3.select(
    "#date-slider"
);

const selectedDateOutputSelection = d3.select(
    "#selected-date-output"
);

const resetExplorationButtonSelection = d3.select(
    "#reset-exploration-button"
);

const timelineChartSelection = d3.select(
    "#timeline-chart"
);

const timelineChartContainerSelection = d3.select(
    "#timeline-chart-container"
);

const chartTooltipSelection = d3.select(
    "#chart-tooltip"
);

const TIMELINE_MARGINS = {
    top: 18,
    right: 24,
    bottom: 46,
    left: 62,
};

const timelineViewState = {
    resizeObserver: null,
    resizeAnimationFrame: null,
    dateScale: null,
    caseRateScale: null,
    innerWidth: 0,
    innerHeight: 0,
};

const mapChartSelection = d3.select(
    "#map-chart"
);

const mapChartContainerSelection = d3.select(
    "#map-chart-container"
);

const mapDateLabelSelection = d3.select(
    "#map-date-label"
);

const interactionGuidanceSelection = d3.select(
    "#interaction-guidance"
);

const sceneCounterSelection = d3.select(
    "#scene-counter"
);

const sceneProgressButtonSelection = d3.selectAll(
    ".scene-progress-button"
);

const sceneKickerSelection = d3.select(
    "#scene-kicker"
);

const sceneTitleSelection = d3.select(
    "#scene-title"
);

const sceneDescriptionSelection = d3.select(
    "#scene-description"
);

const annotationTextSelection = d3.select(
    "#annotation-text"
);

const timelineDateLabelSelection = d3.select(
    "#timeline-date-label"
);

const timelineComparisonLabelSelection = d3.select(
    "#timeline-comparison-label"
);

const previousSceneButtonSelection = d3.select(
    "#previous-scene-button"
);

const nextSceneButtonSelection = d3.select(
    "#next-scene-button"
);

const explorationControlsSelection = d3.select(
    "#exploration-controls"
);

const comparisonControlsSelection = d3.select(
    "#comparison-controls"
);

const comparisonButtonSelection = d3.selectAll(
    ".comparison-button"
);

const MAP_COLOR_THRESHOLDS = [
    10,
    25,
    50,
    100,
    200,
];

const MAP_COLOR_RANGE = [
    "#f3eeee",
    "#ead5d6",
    "#dba9ac",
    "#c6757b",
    "#a94750",
    "#74232a",
];

const mapColorScale = d3
    .scaleThreshold()
    .domain(MAP_COLOR_THRESHOLDS)
    .range(MAP_COLOR_RANGE);

const mapViewState = {
    resizeObserver: null,
    resizeAnimationFrame: null,
};

function positionChartTooltip(pointerEvent) {
    const tooltipNode = chartTooltipSelection.node();

    if (tooltipNode === null) {
        return;
    }

    const pointerOffset = 14;
    const viewportPadding = 12;

    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;

    let tooltipLeft =
        pointerEvent.clientX + pointerOffset;

    let tooltipTop =
        pointerEvent.clientY + pointerOffset;

    if (
        tooltipLeft
        + tooltipWidth
        + viewportPadding
        > window.innerWidth
    ) {
        tooltipLeft =
            pointerEvent.clientX
            - tooltipWidth
            - pointerOffset;
    }

    if (
        tooltipTop
        + tooltipHeight
        + viewportPadding
        > window.innerHeight
    ) {
        tooltipTop =
            pointerEvent.clientY
            - tooltipHeight
            - pointerOffset;
    }

    chartTooltipSelection
        .style(
            "left",
            `${Math.max(
                viewportPadding,
                tooltipLeft
            )}px`
        )
        .style(
            "top",
            `${Math.max(
                viewportPadding,
                tooltipTop
            )}px`
        );
}

function showTimelineTooltip(
    pointerEvent,
    nationalDataRow
) {
    let stateComparisonMarkup = "";

    if (
        visualizationData !== null
        && visualizationState.selectedState
            !== null
    ) {
        const selectedStateRecord =
            visualizationData
                .stateRowsByDate
                .get(
                    nationalDataRow.dateKey
                )
                ?.get(
                    visualizationState
                        .selectedState
                );

        if (
            selectedStateRecord !== undefined
        ) {
            stateComparisonMarkup = `
                <br>
                ${selectedStateRecord.stateName}
                rate:
                ${formatRate(
                    selectedStateRecord
                        .casesAveragePer100k
                )}
                per 100,000
            `;
        }
    }

    chartTooltipSelection
        .property("hidden", false)
        .html(
            `
                <strong>
                    ${formatFullDate(
                        nationalDataRow.date
                    )}
                </strong>
                <br>
                Reported cases:
                ${formatWholeNumber(
                    nationalDataRow.casesAverage
                )}
                seven-day average
                <br>
                National rate:
                ${formatRate(
                    nationalDataRow
                        .casesAveragePer100k
                )}
                per 100,000
                ${stateComparisonMarkup}
                <br>
                Death rate:
                ${formatRate(
                    nationalDataRow
                        .deathsAveragePer100k
                )}
                per 100,000
            `
        );

    positionChartTooltip(pointerEvent);
}

function showStateTooltip(
    pointerEvent,
    stateDataRow,
    nationalDataRow,
    stateRank
) {
    chartTooltipSelection
        .property("hidden", false)
        .html(
            `
                <strong>
                    ${stateDataRow.stateName}
                </strong>
                <br>
                ${formatFullDate(
                    stateDataRow.date
                )}
                <br>
                State rate:
                ${formatRate(
                    stateDataRow
                        .casesAveragePer100k
                )}
                per 100,000
                <br>
                National rate:
                ${formatRate(
                    nationalDataRow
                        .casesAveragePer100k
                )}
                per 100,000
                <br>
                State rank:
                ${stateRank} of 51
            `
        );

    positionChartTooltip(pointerEvent);
}

function hideChartTooltip() {
    chartTooltipSelection
        .property("hidden", true)
        .html("");
}

function parseRequiredNumber(
    rawValue,
    columnName,
    rowDescription
) {
    if (
        rawValue === undefined
        || rawValue === null
        || String(rawValue).trim() === ""
    ) {
        throw new Error(
            `Missing ${columnName} for ${rowDescription}.`
        );
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
        throw new Error(
            `Invalid ${columnName} for ${rowDescription}: ${rawValue}`
        );
    }

    return parsedValue;
}

function parseRequiredDate(dateText, rowDescription) {
    const parsedDate = parseDate(dateText);

    if (parsedDate === null) {
        throw new Error(
            `Invalid date for ${rowDescription}: ${dateText}`
        );
    }

    return parsedDate;
}

function parseNationalDataRow(sourceRow) {
    const date = parseRequiredDate(
        sourceRow.date,
        "a national data row"
    );

    return {
        date,
        dateKey: sourceRow.date,
        casesAverage: parseRequiredNumber(
            sourceRow.cases_avg,
            "cases_avg",
            `the United States on ${sourceRow.date}`
        ),
        casesAveragePer100k: parseRequiredNumber(
            sourceRow.cases_avg_per_100k,
            "cases_avg_per_100k",
            `the United States on ${sourceRow.date}`
        ),
        deathsAverage: parseRequiredNumber(
            sourceRow.deaths_avg,
            "deaths_avg",
            `the United States on ${sourceRow.date}`
        ),
        deathsAveragePer100k: parseRequiredNumber(
            sourceRow.deaths_avg_per_100k,
            "deaths_avg_per_100k",
            `the United States on ${sourceRow.date}`
        ),
    };
}

function parseStateDataRow(sourceRow) {
    const date = parseRequiredDate(
        sourceRow.date,
        `${sourceRow.state} state data`
    );

    const fipsCode = String(sourceRow.fips).padStart(
        2,
        "0"
    );

    if (!/^\d{2}$/.test(fipsCode)) {
        throw new Error(
            `Invalid FIPS code for ${sourceRow.state}: ${sourceRow.fips}`
        );
    }

    return {
        date,
        dateKey: sourceRow.date,
        fipsCode,
        stateName: sourceRow.state,
        casesAveragePer100k: parseRequiredNumber(
            sourceRow.cases_avg_per_100k,
            "cases_avg_per_100k",
            `${sourceRow.state} on ${sourceRow.date}`
        ),
        deathsAveragePer100k: parseRequiredNumber(
            sourceRow.deaths_avg_per_100k,
            "deaths_avg_per_100k",
            `${sourceRow.state} on ${sourceRow.date}`
        ),
    };
}

function createStateDataIndexes(stateDataRows) {
    const stateRowsByDate = new Map();
    const stateSeriesByFips = new Map();
    const stateNameByFips = new Map();
    const fipsCodeByStateName = new Map();

    for (const stateDataRow of stateDataRows) {
        if (!stateRowsByDate.has(stateDataRow.dateKey)) {
            stateRowsByDate.set(
                stateDataRow.dateKey,
                new Map()
            );
        }

        const recordsForDate = stateRowsByDate.get(
            stateDataRow.dateKey
        );

        if (recordsForDate.has(stateDataRow.fipsCode)) {
            throw new Error(
                `Duplicate state record for FIPS ${stateDataRow.fipsCode} on ${stateDataRow.dateKey}.`
            );
        }

        recordsForDate.set(
            stateDataRow.fipsCode,
            stateDataRow
        );

        if (
            !stateSeriesByFips.has(
                stateDataRow.fipsCode
            )
        ) {
            stateSeriesByFips.set(
                stateDataRow.fipsCode,
                []
            );
        }

        stateSeriesByFips
            .get(stateDataRow.fipsCode)
            .push(stateDataRow);

        stateNameByFips.set(
            stateDataRow.fipsCode,
            stateDataRow.stateName
        );

        fipsCodeByStateName.set(
            stateDataRow.stateName,
            stateDataRow.fipsCode
        );
    }

    for (
        const stateSeries
        of stateSeriesByFips.values()
    ) {
        stateSeries.sort(
            (firstRow, secondRow) =>
                firstRow.date - secondRow.date
        );
    }

    return {
        stateRowsByDate,
        stateSeriesByFips,
        stateNameByFips,
        fipsCodeByStateName,
    };
}

function createStateFeatures(
    stateTopology,
    validFipsCodes,
    stateNameByFips
) {
    if (
        !stateTopology.objects
        || !stateTopology.objects.states
    ) {
        throw new Error(
            "The state topology does not contain a states object."
        );
    }

    const allStateFeatures = topojson
        .feature(
            stateTopology,
            stateTopology.objects.states
        )
        .features;

    return allStateFeatures
        .map((stateFeature) => {
            const fipsCode = String(
                stateFeature.id
            ).padStart(2, "0");

            return {
                ...stateFeature,
                id: fipsCode,
                properties: {
                    ...stateFeature.properties,
                    fipsCode,
                    stateName:
                        stateNameByFips.get(fipsCode)
                        ?? stateFeature.properties.name
                        ?? fipsCode,
                },
            };
        })
        .filter((stateFeature) =>
            validFipsCodes.has(stateFeature.id)
        );
}

function validateLoadedData(
    nationalDataRows,
    stateDataRows,
    metadata,
    stateFeatures,
    stateRowsByDate,
    stateNameByFips
) {
    const nationalDateKeys = new Set(
        nationalDataRows.map(
            (nationalDataRow) =>
                nationalDataRow.dateKey
        )
    );

    if (
        nationalDateKeys.size
        !== nationalDataRows.length
    ) {
        throw new Error(
            "The national dataset contains duplicate dates."
        );
    }

    if (stateNameByFips.size !== 51) {
        throw new Error(
            `Expected 51 jurisdictions, but found ${stateNameByFips.size}.`
        );
    }

    if (stateFeatures.length !== 51) {
        throw new Error(
            `Expected 51 geographic features, but found ${stateFeatures.length}.`
        );
    }

    const expectedStateRecordCount =
        nationalDataRows.length
        * stateNameByFips.size;

    if (
        stateDataRows.length
        !== expectedStateRecordCount
    ) {
        throw new Error(
            `Expected ${expectedStateRecordCount} state-date records, but found ${stateDataRows.length}.`
        );
    }

    for (
        const nationalDataRow
        of nationalDataRows
    ) {
        const stateRecordsForDate =
            stateRowsByDate.get(
                nationalDataRow.dateKey
            );

        if (
            !stateRecordsForDate
            || stateRecordsForDate.size !== 51
        ) {
            throw new Error(
                `Expected 51 state records on ${nationalDataRow.dateKey}.`
            );
        }
    }

    for (
        const sceneDefinition
        of SCENE_DEFINITIONS
    ) {
        if (
            sceneDefinition.selectedDateKey
            && !nationalDateKeys.has(
                sceneDefinition.selectedDateKey
            )
        ) {
            throw new Error(
                `Scene ${sceneDefinition.sceneIndex + 1} refers to a missing date: ${sceneDefinition.selectedDateKey}.`
            );
        }

        if (
            sceneDefinition.comparisonDateKey
            && !nationalDateKeys.has(
                sceneDefinition.comparisonDateKey
            )
        ) {
            throw new Error(
                `Scene ${sceneDefinition.sceneIndex + 1} refers to a missing comparison date: ${sceneDefinition.comparisonDateKey}.`
            );
        }
    }

    if (
        metadata.records.national
        !== nationalDataRows.length
    ) {
        throw new Error(
            "The national record count does not match metadata.json."
        );
    }

    if (
        metadata.records.states_and_district
        !== stateDataRows.length
    ) {
        throw new Error(
            "The state record count does not match metadata.json."
        );
    }
}

function populateStateSelection(
    fipsCodeByStateName
) {
    const stateOptions = Array.from(
        fipsCodeByStateName.entries()
    )
        .sort(
            (
                [firstStateName],
                [secondStateName]
            ) =>
                d3.ascending(
                    firstStateName,
                    secondStateName
                )
        )
        .map(
            ([stateName, fipsCode]) => ({
                stateName,
                fipsCode,
            })
        );

    stateSelectionControl
        .selectAll(
            "option.state-option"
        )
        .data(
            stateOptions,
            (stateOption) =>
                stateOption.fipsCode
        )
        .join("option")
        .attr("class", "state-option")
        .attr(
            "value",
            (stateOption) =>
                stateOption.fipsCode
        )
        .text(
            (stateOption) =>
                stateOption.stateName
        );
}

function initializeStateParameters(
    nationalDataRows
) {
    const initialDate =
        nationalDataRows[0].date;

    visualizationState.currentSceneIndex = 0;
    visualizationState.selectedDate =
        initialDate;
    visualizationState.selectedState = null;
    visualizationState.hoveredState = null;
    visualizationState.comparisonDate = null;
    visualizationState.explorationEnabled =
        false;
    visualizationState.isTransitioning =
        false;

    dateSliderControl
        .attr("min", 0)
        .attr(
            "max",
            nationalDataRows.length - 1
        )
        .property("value", 0);

    selectedDateOutputSelection.text(
        formatFullDate(initialDate)
    );
}

function updateExplorationControls() {
    const explorationIsAvailable =
        visualizationState.currentSceneIndex === 3;

    explorationControlsSelection.property(
        "hidden",
        !explorationIsAvailable
    );

    stateSelectionGroupSelection.property(
        "hidden",
        !explorationIsAvailable
    );

    dateSliderControl.property(
        "disabled",
        !explorationIsAvailable
        || visualizationState.isTransitioning
    );

    stateSelectionControl.property(
        "disabled",
        !explorationIsAvailable
        || visualizationState.isTransitioning
    );

    resetExplorationButtonSelection.property(
        "disabled",
        !explorationIsAvailable
        || visualizationState.isTransitioning
    );
}

function updateComparisonControls() {
    const comparisonIsAvailable =
        visualizationState.currentSceneIndex === 2;

    comparisonControlsSelection.property(
        "hidden",
        !comparisonIsAvailable
    );

    if (!comparisonIsAvailable) {
        return;
    }

    const selectedDateKey = formatDateKey(
        visualizationState.selectedDate
    );

    comparisonButtonSelection
        .property(
            "disabled",
            visualizationState.isTransitioning
        )
        .classed(
            "active",
            function () {
                return (
                    this.dataset.comparisonDate
                    === selectedDateKey
                );
            }
        )
        .attr(
            "aria-pressed",
            function () {
                return (
                    this.dataset.comparisonDate
                    === selectedDateKey
                )
                    ? "true"
                    : "false";
            }
        );
}

function updateSceneNavigationControls() {
    const currentSceneIndex =
        visualizationState.currentSceneIndex;

    previousSceneButtonSelection.property(
        "disabled",
        currentSceneIndex === 0
        || visualizationState.isTransitioning
    );

    nextSceneButtonSelection.property(
        "disabled",
        currentSceneIndex
            === SCENE_DEFINITIONS.length - 1
        || visualizationState.isTransitioning
    );

    sceneProgressButtonSelection
        .property(
            "disabled",
            visualizationState.isTransitioning
        )
        .classed(
            "active",
            function () {
                return Number(
                    this.dataset.sceneIndex
                ) === currentSceneIndex;
            }
        )
        .attr(
            "aria-current",
            function () {
                return Number(
                    this.dataset.sceneIndex
                ) === currentSceneIndex
                    ? "step"
                    : null;
            }
        );
}

function updateSceneText(sceneDefinition) {
    sceneCounterSelection.text(
        `Scene ${
            sceneDefinition.sceneIndex + 1
        } of ${SCENE_DEFINITIONS.length}`
    );

    sceneKickerSelection.text(
        sceneDefinition.kicker
    );

    sceneTitleSelection.text(
        sceneDefinition.title
    );

    sceneDescriptionSelection.text(
        sceneDefinition.description
    );

    annotationTextSelection.text(
        sceneDefinition.annotation
    );

    interactionGuidanceSelection.text(
        sceneDefinition.interactionGuidance
    );
}

function getSceneSelectedDate(
    sceneDefinition
) {
    if (
        sceneDefinition.selectedDateKey
        === null
    ) {
        return visualizationData
            .nationalDataRows[0].date;
    }

    const nationalDataRow =
        visualizationData
            .nationalDataByDate
            .get(
                sceneDefinition
                    .selectedDateKey
            );

    if (nationalDataRow === undefined) {
        throw new Error(
            `No national data exists for scene date ${sceneDefinition.selectedDateKey}.`
        );
    }

    return nationalDataRow.date;
}

function updateDateControls() {
    const selectedDateKey =
        formatDateKey(
            visualizationState.selectedDate
        );

    const selectedDateIndex =
        visualizationData
            .nationalDataRows
            .findIndex(
                (nationalDataRow) =>
                    nationalDataRow.dateKey
                    === selectedDateKey
            );

    if (selectedDateIndex >= 0) {
        dateSliderControl.property(
            "value",
            selectedDateIndex
        );
    }

    selectedDateOutputSelection.text(
        formatFullDate(
            visualizationState.selectedDate
        )
    );
}

function updateSceneFourExplorationText() {
    if (
        visualizationData === null
        || visualizationState.currentSceneIndex !== 3
        || visualizationState.selectedDate === null
    ) {
        return;
    }

    const selectedDateKey = formatDateKey(
        visualizationState.selectedDate
    );

    const nationalDataRow =
        visualizationData
            .nationalDataByDate
            .get(selectedDateKey);

    const stateRecordsForDate =
        visualizationData
            .stateRowsByDate
            .get(selectedDateKey);

    if (
        nationalDataRow === undefined
        || stateRecordsForDate === undefined
    ) {
        return;
    }

    const rankedStateRecords = Array.from(
        stateRecordsForDate.values()
    ).sort(
        (
            firstStateRecord,
            secondStateRecord
        ) =>
            d3.descending(
                firstStateRecord
                    .casesAveragePer100k,
                secondStateRecord
                    .casesAveragePer100k
            )
    );

    const highestStateRecord =
        rankedStateRecords[0];

    const jurisdictionsAbove50 =
        rankedStateRecords.filter(
            (stateRecord) =>
                stateRecord
                    .casesAveragePer100k
                > 50
        ).length;

    const jurisdictionsAbove100 =
        rankedStateRecords.filter(
            (stateRecord) =>
                stateRecord
                    .casesAveragePer100k
                > 100
        ).length;

    sceneDescriptionSelection.text(
        `On ${formatFullDate(
            nationalDataRow.date
        )}, the national seven-day average was ${formatRate(
            nationalDataRow
                .casesAveragePer100k
        )} reported cases per 100,000.`
    );

    if (
        visualizationState.selectedState
        !== null
    ) {
        const selectedStateRecord =
            stateRecordsForDate.get(
                visualizationState
                    .selectedState
            );

        if (
            selectedStateRecord !== undefined
        ) {
            const selectedStateRank =
                rankedStateRecords.findIndex(
                    (stateRecord) =>
                        stateRecord.fipsCode
                        === selectedStateRecord
                            .fipsCode
                ) + 1;

            annotationTextSelection.text(
                `${selectedStateRecord.stateName} reported ${formatRate(
                    selectedStateRecord
                        .casesAveragePer100k
                )} cases per 100,000, ranking ${selectedStateRank} of 51. ${highestStateRecord.stateName} had the highest rate at ${formatRate(
                    highestStateRecord
                        .casesAveragePer100k
                )}.`
            );

            interactionGuidanceSelection.text(
                "Select another state, click a state on the map, or move the date slider to continue comparing patterns."
            );

            return;
        }
    }

    annotationTextSelection.text(
        `${highestStateRecord.stateName} had the highest state rate at ${formatRate(
            highestStateRecord
                .casesAveragePer100k
        )} per 100,000. ${jurisdictionsAbove50} of 51 jurisdictions exceeded 50, and ${jurisdictionsAbove100} exceeded 100.`
    );

    interactionGuidanceSelection.text(
        "Select a state or click it on the map to compare its full timeline with the national curve."
    );
}

function applySceneFourStateSelection(
    requestedFipsCode
) {
    if (
        visualizationData === null
        || visualizationState.currentSceneIndex !== 3
        || visualizationState.isTransitioning
    ) {
        return;
    }

    const normalizedFipsCode =
        requestedFipsCode === ""
        || requestedFipsCode === null
        || requestedFipsCode === undefined
            ? null
            : String(
                requestedFipsCode
            ).padStart(2, "0");

    if (
        normalizedFipsCode !== null
        && !visualizationData
            .stateNameByFips
            .has(normalizedFipsCode)
    ) {
        throw new Error(
            `Unknown state FIPS code: ${normalizedFipsCode}`
        );
    }

    visualizationState.selectedState =
        normalizedFipsCode;

    stateSelectionControl.property(
        "value",
        normalizedFipsCode ?? ""
    );

    updateSceneFourExplorationText();

    hideChartTooltip();

    renderNationalTimeline();

    renderStateMap({
        animateMap: false,
    });

    console.log(
        "Scene 4 state selection changed:",
        visualizationState
    );
}

async function applySceneFourDateIndex(
    requestedDateIndex,
    {
        animateMap = false,
        restoreNarrative = false,
    } = {}
) {
    if (
        visualizationData === null
        || visualizationState.currentSceneIndex !== 3
        || visualizationState.isTransitioning
    ) {
        return;
    }

    const boundedDateIndex = Math.max(
        0,
        Math.min(
            visualizationData
                .nationalDataRows.length - 1,
            requestedDateIndex
        )
    );

    const requestedNationalDataRow =
        visualizationData
            .nationalDataRows[
                boundedDateIndex
            ];

    const previousDate =
        visualizationState.selectedDate;

    const dateChanged =
        previousDate === null
        || previousDate.getTime()
            !== requestedNationalDataRow
                .date.getTime();

    if (
        !dateChanged
        && !restoreNarrative
    ) {
        return;
    }

    const shouldAnimate =
        animateMap && dateChanged;

    visualizationState.isTransitioning =
        shouldAnimate;

    visualizationState.selectedDate =
        requestedNationalDataRow.date;

    visualizationState.hoveredState =
        null;

    updateDateControls();

    timelineDateLabelSelection.text(
        formatFullDate(
            visualizationState.selectedDate
        )
    );

    if (restoreNarrative) {
        updateSceneText(
            SCENE_DEFINITIONS[3]
        );
    } else {
        updateSceneFourExplorationText();
    }

    updateSceneNavigationControls();
    updateComparisonControls();
    updateExplorationControls();
    hideChartTooltip();

    try {
        await Promise.all([
            renderStateMap({
                previousDate,
                previousSceneIndex: 3,
                animateMap:
                    shouldAnimate,
            }),

            updateTimelineSceneMarker(
                shouldAnimate
            ),
        ]);
    } finally {
        visualizationState.isTransitioning =
            false;

        updateSceneNavigationControls();
        updateComparisonControls();
        updateExplorationControls();
    }

    console.log(
        `Scene 4 exploration changed to ${
            requestedNationalDataRow.dateKey
        }:`,
        visualizationState
    );
}

async function applySceneThreeComparisonDate(
    requestedDateKey
) {
    if (
        visualizationData === null
        || visualizationState.currentSceneIndex !== 2
        || visualizationState.isTransitioning
    ) {
        return;
    }

    const comparisonContent =
        SCENE_THREE_COMPARISON_CONTENT[
            requestedDateKey
        ];

    const requestedNationalDataRow =
        visualizationData
            .nationalDataByDate
            .get(requestedDateKey);

    if (
        comparisonContent === undefined
        || requestedNationalDataRow === undefined
    ) {
        throw new Error(
            `Invalid Scene 3 comparison date: ${requestedDateKey}`
        );
    }

    const currentDateKey = formatDateKey(
        visualizationState.selectedDate
    );

    if (currentDateKey === requestedDateKey) {
        return;
    }

    const previousDate =
        visualizationState.selectedDate;

    const alternateDateKey =
        requestedDateKey === "2020-04-10"
            ? "2020-07-25"
            : "2020-04-10";

    visualizationState.isTransitioning = true;

    visualizationState.selectedDate =
        requestedNationalDataRow.date;

    visualizationState.comparisonDate =
        visualizationData
            .nationalDataByDate
            .get(alternateDateKey)
            .date;

    sceneDescriptionSelection.text(
        comparisonContent.description
    );

    annotationTextSelection.text(
        comparisonContent.annotation
    );

    interactionGuidanceSelection.text(
        comparisonContent
            .interactionGuidance
    );

    timelineDateLabelSelection.text(
        formatFullDate(
            visualizationState.selectedDate
        )
    );

    updateDateControls();
    updateSceneNavigationControls();
    updateComparisonControls();
    hideChartTooltip();

    try {
        await Promise.all([
            renderStateMap({
                previousDate,
                previousSceneIndex: 2,
                animateMap: true,
            }),

            updateTimelineSceneMarker(true),
        ]);
    } finally {
        visualizationState.isTransitioning =
            false;

        updateSceneNavigationControls();
        updateComparisonControls();
    }

    console.log(
        `Scene 3 comparison changed to ${requestedDateKey}:`,
        visualizationState
    );
}

async function applyScene(
    requestedSceneIndex
) {
    if (
        visualizationData === null
        || visualizationState
            .isTransitioning
    ) {
        return;
    }

    const boundedSceneIndex = Math.max(
        0,
        Math.min(
            SCENE_DEFINITIONS.length - 1,
            requestedSceneIndex
        )
    );

    const sceneDefinition =
        SCENE_DEFINITIONS[
            boundedSceneIndex
        ];

    const previousDate =
        visualizationState.selectedDate;

    const previousSceneIndex =
        visualizationState
            .currentSceneIndex;

    const previousSelectedState =
        visualizationState.selectedState;

    const shouldAnimate =
        previousDate !== null
        && previousSceneIndex
            !== boundedSceneIndex;

    visualizationState.isTransitioning =
        shouldAnimate;

    visualizationState.currentSceneIndex =
        boundedSceneIndex;

    visualizationState.selectedDate =
        getSceneSelectedDate(
            sceneDefinition
        );

    visualizationState.selectedState =
        null;

    visualizationState.hoveredState =
        null;

    visualizationState.comparisonDate =
        sceneDefinition.comparisonDateKey
            === null
            ? null
            : visualizationData
                .nationalDataByDate
                .get(
                    sceneDefinition
                        .comparisonDateKey
                )
                .date;

    visualizationState.explorationEnabled =
        sceneDefinition
            .explorationEnabled;

    stateSelectionControl.property(
        "value",
        ""
    );

    updateSceneText(
        sceneDefinition
    );

    updateDateControls();

    updateSceneNavigationControls();

    updateComparisonControls();
    updateExplorationControls();

    if (boundedSceneIndex === 0) {
        timelineDateLabelSelection.text(
            "January 2020–March 2023"
        );
    } else {
        timelineDateLabelSelection.text(
            formatFullDate(
                visualizationState
                    .selectedDate
            )
        );
    }

    hideChartTooltip();

    if (previousSelectedState !== null) {
        renderNationalTimeline();
    }

    try {
        await Promise.all([
            renderStateMap({
                previousDate,
                previousSceneIndex,
                animateMap:
                    shouldAnimate,
            }),

            updateTimelineSceneMarker(
                shouldAnimate
            ),
        ]);
    } finally {
        visualizationState.isTransitioning =
            false;

        updateSceneNavigationControls();
        updateComparisonControls();
        updateExplorationControls();
    }

    console.log(
        `Changed to scene ${
            boundedSceneIndex + 1
        }:`,
        visualizationState
    );
}

function initializeSceneTriggers() {
    previousSceneButtonSelection.on(
        "click",
        () => {
            applyScene(
                visualizationState
                    .currentSceneIndex - 1
            );
        }
    );

    nextSceneButtonSelection.on(
        "click",
        () => {
            applyScene(
                visualizationState
                    .currentSceneIndex + 1
            );
        }
    );

    sceneProgressButtonSelection.on(
        "click",
        function () {
            applyScene(
                Number(
                    this.dataset.sceneIndex
                )
            );
        }
    );

    comparisonButtonSelection.on(
        "click",
        function () {
            applySceneThreeComparisonDate(
                this.dataset.comparisonDate
            );
        }
    );

    stateSelectionControl.on(
        "change",
        function () {
            applySceneFourStateSelection(
                this.value
            );
        }
    );

    dateSliderControl.on(
        "input",
        function () {
            applySceneFourDateIndex(
                Number(this.value),
                {
                    animateMap: false,
                    restoreNarrative: false,
                }
            );
        }
    );

    resetExplorationButtonSelection.on(
        "click",
        async () => {
            visualizationState.selectedState =
                null;

            stateSelectionControl.property(
                "value",
                ""
            );

            const resetDateIndex =
                visualizationData
                    .nationalDataRows
                    .findIndex(
                        (nationalDataRow) =>
                            nationalDataRow
                                .dateKey
                            === "2022-01-14"
                    );

            await applySceneFourDateIndex(
                resetDateIndex,
                {
                    animateMap: true,
                    restoreNarrative: true,
                }
            );

            renderNationalTimeline();
        }
    );

    window.addEventListener(
        "keydown",
        (keyboardEvent) => {
            const activeElement =
                document.activeElement;

            const isFormControl =
                activeElement
                instanceof HTMLInputElement
                || activeElement
                instanceof HTMLSelectElement
                || activeElement
                instanceof HTMLButtonElement;

            if (isFormControl) {
                return;
            }

            if (
                keyboardEvent.key
                === "ArrowRight"
            ) {
                applyScene(
                    visualizationState
                        .currentSceneIndex
                        + 1
                );
            }

            if (
                keyboardEvent.key
                === "ArrowLeft"
            ) {
                applyScene(
                    visualizationState
                        .currentSceneIndex
                        - 1
                );
            }
        }
    );
}

function updateTimelineSceneMarker(
    animateMarker = true
) {
    if (
        visualizationData === null
        || timelineViewState.dateScale === null
        || timelineViewState.caseRateScale === null
        || visualizationState.selectedDate === null
    ) {
        return Promise.resolve();
    }

    const markerGroup =
        timelineChartSelection.select(
            ".timeline-scene-marker"
        );

    if (markerGroup.empty()) {
        return Promise.resolve();
    }

    const isOverviewScene =
        visualizationState.currentSceneIndex === 0;

    if (isOverviewScene) {
        if (!animateMarker) {
            markerGroup
                .style("display", "none")
                .style("opacity", 0);

            return Promise.resolve();
        }

        return markerGroup
            .transition()
            .duration(250)
            .style("opacity", 0)
            .end()
            .catch(() => undefined)
            .then(() => {
                markerGroup.style(
                    "display",
                    "none"
                );
            });
    }

    const selectedDateKey = formatDateKey(
        visualizationState.selectedDate
    );

    const nationalDataRow =
        visualizationData
            .nationalDataByDate
            .get(selectedDateKey);

    if (nationalDataRow === undefined) {
        return Promise.resolve();
    }

    const markerX =
        timelineViewState.dateScale(
            nationalDataRow.date
        );

    const markerY =
        timelineViewState.caseRateScale(
            nationalDataRow
                .casesAveragePer100k
        );

    const placeLabelOnLeft =
        markerX
        > timelineViewState.innerWidth - 130;

    const markerLabelX =
        placeLabelOnLeft
            ? markerX - 8
            : markerX + 8;

    const markerLabelAnchor =
        placeLabelOnLeft
            ? "end"
            : "start";

    const markerLine =
        markerGroup.select(
            ".timeline-scene-marker-line"
        );

    const markerPoint =
        markerGroup.select(
            ".timeline-scene-marker-point"
        );

    const markerLabel =
        markerGroup.select(
            ".timeline-scene-marker-label"
        );

    const markerWasHidden =
        markerGroup.style("display") === "none";

    markerGroup.style("display", null);

    markerLabel
        .attr(
            "text-anchor",
            markerLabelAnchor
        )
        .text(
            formatFullDate(
                nationalDataRow.date
            )
        );

    if (
        !animateMarker
        || markerWasHidden
    ) {
        markerLine
            .attr("x1", markerX)
            .attr("x2", markerX)
            .attr("y1", 0)
            .attr(
                "y2",
                timelineViewState.innerHeight
            );

        markerPoint
            .attr("cx", markerX)
            .attr("cy", markerY);

        markerLabel
            .attr("x", markerLabelX)
            .attr("y", 14);

        if (!animateMarker) {
            markerGroup.style("opacity", 1);
            return Promise.resolve();
        }

        markerGroup.style("opacity", 0);

        return markerGroup
            .transition()
            .duration(350)
            .style("opacity", 1)
            .end()
            .catch(() => undefined);
    }

    const markerTransition = d3
        .transition()
        .duration(750)
        .ease(d3.easeCubicInOut);

    const groupTransition =
        markerGroup
            .transition(markerTransition)
            .style("opacity", 1);

    const lineTransition =
        markerLine
            .transition(markerTransition)
            .attr("x1", markerX)
            .attr("x2", markerX)
            .attr("y1", 0)
            .attr(
                "y2",
                timelineViewState.innerHeight
            );

    const pointTransition =
        markerPoint
            .transition(markerTransition)
            .attr("cx", markerX)
            .attr("cy", markerY);

    const labelTransition =
        markerLabel
            .transition(markerTransition)
            .attr("x", markerLabelX)
            .attr("y", 14);

    return Promise.all([
        groupTransition.end(),
        lineTransition.end(),
        pointTransition.end(),
        labelTransition.end(),
    ]).catch(() => undefined);
}

function renderNationalTimeline() {
    if (visualizationData === null) {
        return;
    }

    const timelineContainerNode =
        timelineChartContainerSelection.node();

    if (timelineContainerNode === null) {
        return;
    }

    const containerWidth =
        timelineContainerNode.clientWidth;

    const chartWidth = Math.max(
        360,
        containerWidth
    );

    const chartHeight =
        chartWidth < 620
            ? 250
            : 280;

    const innerWidth =
        chartWidth
        - TIMELINE_MARGINS.left
        - TIMELINE_MARGINS.right;

    const innerHeight =
        chartHeight
        - TIMELINE_MARGINS.top
        - TIMELINE_MARGINS.bottom;

    const nationalDataRows =
        visualizationData.nationalDataRows;

    const selectedStateSeries =
        visualizationState.selectedState
            === null
            ? null
            : visualizationData
                .stateSeriesByFips
                .get(
                    visualizationState
                        .selectedState
                )
                ?? null;

    const selectedStateName =
        visualizationState.selectedState
            === null
            ? null
            : visualizationData
                .stateNameByFips
                .get(
                    visualizationState
                        .selectedState
                )
                ?? null;

    const dateExtent = d3.extent(
        nationalDataRows,
        (nationalDataRow) =>
            nationalDataRow.date
    );

    const maximumNationalCaseRate = d3.max(
        nationalDataRows,
        (nationalDataRow) =>
            nationalDataRow
                .casesAveragePer100k
    ) ?? 0;

    const maximumSelectedStateRate =
        selectedStateSeries === null
            ? 0
            : d3.max(
                selectedStateSeries,
                (stateDataRow) =>
                    stateDataRow
                        .casesAveragePer100k
            ) ?? 0;

    const maximumCaseRate = Math.max(
        maximumNationalCaseRate,
        maximumSelectedStateRate
    );

    timelineComparisonLabelSelection
        .property(
            "hidden",
            selectedStateName === null
        )
        .text(
            selectedStateName === null
                ? ""
                : `National rate compared with ${selectedStateName}`
        );

    const dateScale = d3
        .scaleUtc()
        .domain(dateExtent)
        .range([0, innerWidth]);

    const caseRateScale = d3
        .scaleLinear()
        .domain([0, maximumCaseRate])
        .nice()
        .range([innerHeight, 0]);

    timelineViewState.dateScale =
        dateScale;

    timelineViewState.caseRateScale =
        caseRateScale;

    timelineViewState.innerWidth =
        innerWidth;

    timelineViewState.innerHeight =
        innerHeight;

    timelineChartSelection
        .attr(
            "viewBox",
            `0 0 ${chartWidth} ${chartHeight}`
        )
        .attr(
            "preserveAspectRatio",
            "xMidYMid meet"
        );

    timelineChartContainerSelection
        .classed("rendered", true)
        .style(
            "height",
            `${chartHeight}px`
        );

    timelineChartSelection
        .selectAll("*")
        .remove();

    const chartGroup =
        timelineChartSelection
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${TIMELINE_MARGINS.left},
                    ${TIMELINE_MARGINS.top}
                )`
            );

    chartGroup
        .append("g")
        .attr("class", "chart-grid")
        .call(
            d3
                .axisLeft(caseRateScale)
                .ticks(5)
                .tickSize(-innerWidth)
                .tickFormat("")
        );

    const yearTickValues = [
        parseDate("2020-01-21"),
        parseDate("2021-01-01"),
        parseDate("2022-01-01"),
        parseDate("2023-01-01"),
    ];

    chartGroup
        .append("g")
        .attr(
            "class",
            "chart-axis timeline-x-axis"
        )
        .attr(
            "transform",
            `translate(0, ${innerHeight})`
        )
        .call(
            d3
                .axisBottom(dateScale)
                .tickValues(yearTickValues)
                .tickFormat(
                    d3.utcFormat("%Y")
                )
                .tickSizeOuter(0)
        );

    chartGroup
        .append("g")
        .attr(
            "class",
            "chart-axis timeline-y-axis"
        )
        .call(
            d3
                .axisLeft(caseRateScale)
                .ticks(5)
                .tickFormat(
                    d3.format(",.0f")
                )
                .tickSizeOuter(0)
        );

    chartGroup
        .append("text")
        .attr("class", "axis-label")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -innerHeight / 2
        )
        .attr("y", -48)
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Cases per 100,000"
        );

    const nationalAreaGenerator = d3
        .area()
        .x(
            (nationalDataRow) =>
                dateScale(
                    nationalDataRow.date
                )
        )
        .y0(innerHeight)
        .y1(
            (nationalDataRow) =>
                caseRateScale(
                    nationalDataRow
                        .casesAveragePer100k
                )
        )
        .curve(d3.curveMonotoneX);

    const nationalLineGenerator = d3
        .line()
        .x(
            (nationalDataRow) =>
                dateScale(
                    nationalDataRow.date
                )
        )
        .y(
            (nationalDataRow) =>
                caseRateScale(
                    nationalDataRow
                        .casesAveragePer100k
                )
        )
        .curve(d3.curveMonotoneX);

    chartGroup
        .append("path")
        .datum(nationalDataRows)
        .attr(
            "class",
            "national-area"
        )
        .attr(
            "d",
            nationalAreaGenerator
        );

    chartGroup
        .append("path")
        .datum(nationalDataRows)
        .attr(
            "class",
            "national-line"
        )
        .attr(
            "d",
            nationalLineGenerator
        );

    if (selectedStateSeries !== null) {
        const selectedStateLineGenerator = d3
            .line()
            .x(
                (stateDataRow) =>
                    dateScale(
                        stateDataRow.date
                    )
            )
            .y(
                (stateDataRow) =>
                    caseRateScale(
                        stateDataRow
                            .casesAveragePer100k
                    )
            )
            .curve(d3.curveMonotoneX);

        chartGroup
            .append("path")
            .datum(selectedStateSeries)
            .attr(
                "class",
                "state-comparison-line"
            )
            .attr(
                "d",
                selectedStateLineGenerator
            );
    }
    
    const timelineSceneMarkerGroup =
        chartGroup
            .append("g")
            .attr(
                "class",
                "timeline-scene-marker"
            )
            .style("display", "none")
            .style("opacity", 0);

    timelineSceneMarkerGroup
        .append("line")
        .attr(
            "class",
            "timeline-scene-marker-line"
        );

    timelineSceneMarkerGroup
        .append("circle")
        .attr(
            "class",
            "timeline-scene-marker-point"
        )
        .attr("r", 5);

    timelineSceneMarkerGroup
        .append("text")
        .attr(
            "class",
            "timeline-scene-marker-label"
        );

    const timelineFocusGroup =
        chartGroup
            .append("g")
            .attr(
                "class",
                "timeline-focus"
            )
            .style("display", "none");

    const timelineFocusLine =
        timelineFocusGroup
            .append("line")
            .attr(
                "class",
                "timeline-focus-line"
            )
            .attr("y1", 0)
            .attr(
                "y2",
                innerHeight
            );

    const timelineFocusPoint =
        timelineFocusGroup
            .append("circle")
            .attr(
                "class",
                "timeline-focus-point"
            )
            .attr("r", 5);

    const findNearestDateIndex =
        d3.bisector(
            (nationalDataRow) =>
                nationalDataRow.date
        ).center;

    chartGroup
        .append("rect")
        .attr(
            "class",
            "timeline-interaction-layer"
        )
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .on(
            "pointerenter",
            () => {
                timelineFocusGroup.style(
                    "display",
                    null
                );
            }
        )
        .on(
            "pointermove",
            function (pointerEvent) {
                const [
                    pointerX
                ] = d3.pointer(
                    pointerEvent,
                    this
                );

                const hoveredDate =
                    dateScale.invert(
                        pointerX
                    );

                const nearestDateIndex =
                    findNearestDateIndex(
                        nationalDataRows,
                        hoveredDate
                    );

                const nationalDataRow =
                    nationalDataRows[
                        nearestDateIndex
                    ];

                const focusX =
                    dateScale(
                        nationalDataRow.date
                    );

                const focusY =
                    caseRateScale(
                        nationalDataRow
                            .casesAveragePer100k
                    );

                timelineFocusLine
                    .attr("x1", focusX)
                    .attr("x2", focusX);

                timelineFocusPoint
                    .attr("cx", focusX)
                    .attr("cy", focusY);

                showTimelineTooltip(
                    pointerEvent,
                    nationalDataRow
                );
            }
        )
        .on(
            "pointerleave",
            () => {
                timelineFocusGroup.style(
                    "display",
                    "none"
                );

                hideChartTooltip();
            }
        );

    updateTimelineSceneMarker(false);
}

function initializeTimelineResizeObserver() {
    const timelineContainerNode =
        timelineChartContainerSelection.node();

    if (
        timelineContainerNode === null
        || timelineViewState.resizeObserver
            !== null
    ) {
        return;
    }

    if (
        typeof ResizeObserver
        === "function"
    ) {
        timelineViewState.resizeObserver =
            new ResizeObserver(() => {
                if (
                    timelineViewState
                        .resizeAnimationFrame
                    !== null
                ) {
                    cancelAnimationFrame(
                        timelineViewState
                            .resizeAnimationFrame
                    );
                }

                timelineViewState
                    .resizeAnimationFrame =
                    requestAnimationFrame(
                        renderNationalTimeline
                    );
            });

        timelineViewState.resizeObserver
            .observe(
                timelineContainerNode
            );

        return;
    }

    window.addEventListener(
        "resize",
        renderNationalTimeline
    );
}

function renderStateMap({
    previousDate = null,
    previousSceneIndex = null,
    animateMap = false,
} = {}) {
    if (
        visualizationData === null
        || visualizationState.selectedDate
            === null
    ) {
        return;
    }

    const mapContainerNode =
        mapChartContainerSelection.node();

    if (mapContainerNode === null) {
        return;
    }

    const containerWidth =
        mapContainerNode.clientWidth;

    const chartWidth = Math.max(
        360,
        containerWidth
    );

    const chartHeight =
        chartWidth < 620
            ? 340
            : Math.min(
                500,
                Math.max(
                    400,
                    chartWidth * 0.57
                )
            );
    
    const isNationalOverviewScene =
        visualizationState
            .currentSceneIndex === 0;
            
    const previousDateKey =
        previousDate === null
            ? null
            : formatDateKey(previousDate);

    const previousWasOverviewScene =
        previousSceneIndex === 0;

    const selectedDateKey =
        formatDateKey(
            visualizationState.selectedDate
        );

    const stateRecordsForDate =
        visualizationData
            .stateRowsByDate
            .get(selectedDateKey);

    const nationalDataRow =
        visualizationData
            .nationalDataByDate
            .get(selectedDateKey);

    if (
        stateRecordsForDate === undefined
        || nationalDataRow === undefined
    ) {
        throw new Error(
            `Map data was not found for ${selectedDateKey}.`
        );
    }

    function getMapFill(
        mapFeatureRow,
        dateKey,
        overviewScene
    ) {
        if (overviewScene) {
            return MAP_COLOR_RANGE[0];
        }

        if (dateKey === null) {
            return MAP_COLOR_RANGE[0];
        }

        const stateRecord =
            visualizationData
                .stateRowsByDate
                .get(dateKey)
                ?.get(
                    mapFeatureRow
                        .stateFeature.id
                );

        if (stateRecord === undefined) {
            return "#e5e7eb";
        }

        return mapColorScale(
            stateRecord.casesAveragePer100k
        );
    }

    const rankedStateRecords =
        Array.from(
            stateRecordsForDate.values()
        ).sort(
            (
                firstStateRecord,
                secondStateRecord
            ) =>
                d3.descending(
                    firstStateRecord
                        .casesAveragePer100k,
                    secondStateRecord
                        .casesAveragePer100k
                )
        );

    const stateRankByFips = new Map(
        rankedStateRecords.map(
            (
                stateDataRow,
                stateIndex
            ) => [
                stateDataRow.fipsCode,
                stateIndex + 1,
            ]
        )
    );

    const mapFeatureRows =
        visualizationData.stateFeatures.map(
            (stateFeature) => ({
                stateFeature,
                stateDataRow:
                    stateRecordsForDate.get(
                        stateFeature.id
                    ),
            })
        );

    const featureCollection = {
        type: "FeatureCollection",
        features:
            visualizationData.stateFeatures,
    };

    const mapProjection = d3
        .geoAlbersUsa()
        .fitExtent(
            [
                [16, 16],
                [
                    chartWidth - 16,
                    chartHeight - 24,
                ],
            ],
            featureCollection
        );

    const mapPathGenerator = d3.geoPath(
        mapProjection
    );

    mapChartSelection
        .attr(
            "viewBox",
            `0 0 ${chartWidth} ${chartHeight}`
        )
        .attr(
            "preserveAspectRatio",
            "xMidYMid meet"
        );

    mapChartContainerSelection
        .classed("rendered", true)
        .style(
            "height",
            `${chartHeight}px`
        );

    mapChartSelection
        .selectAll("*")
        .remove();

    mapChartSelection
        .append("rect")
        .attr(
            "class",
            "map-background"
        )
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    const statePathSelection =
        mapChartSelection
            .append("g")
            .attr(
                "class",
                "state-layer"
            )
            .selectAll(
                "path.state-shape"
            )
            .data(
                mapFeatureRows,
                (mapFeatureRow) =>
                    mapFeatureRow
                        .stateFeature.id
            )
            .join("path")
            .attr(
                "class",
                "state-shape"
            )
            .classed(
                "selected",
                (mapFeatureRow) =>
                    mapFeatureRow
                        .stateFeature.id
                    === visualizationState
                        .selectedState
            )
            .attr(
                "d",
                (mapFeatureRow) =>
                    mapPathGenerator(
                        mapFeatureRow
                            .stateFeature
                    )
            )
            .attr(
                "fill",
                (mapFeatureRow) => {
                    if (
                        animateMap
                        && previousDateKey !== null
                    ) {
                        return getMapFill(
                            mapFeatureRow,
                            previousDateKey,
                            previousWasOverviewScene
                        );
                    }

                    return getMapFill(
                        mapFeatureRow,
                        selectedDateKey,
                        isNationalOverviewScene
                    );
                }
            )
            .attr(
                "tabindex",
                isNationalOverviewScene
                    ? -1
                    : 0
            )
            .attr(
                "role",
                "button"
            )
            .attr(
                "aria-label",
                (mapFeatureRow) => {
                    const stateDataRow =
                        mapFeatureRow
                            .stateDataRow;

                    if (
                        stateDataRow
                        === undefined
                    ) {
                        return (
                            mapFeatureRow
                                .stateFeature
                                .properties
                                .stateName
                            + ": no data"
                        );
                    }

                    return (
                        `${stateDataRow.stateName}: `
                        + `${formatRate(
                            stateDataRow
                                .casesAveragePer100k
                        )} reported cases `
                        + "per 100,000 on "
                        + `${formatFullDate(
                            stateDataRow.date
                        )}.`
                    );
                }
            );
    
    let mapTransitionPromise =
        Promise.resolve();

    if (animateMap) {
        const mapTransition =
            statePathSelection
                .transition()
                .duration(750)
                .ease(d3.easeCubicInOut)
                .attr(
                    "fill",
                    (mapFeatureRow) =>
                        getMapFill(
                            mapFeatureRow,
                            selectedDateKey,
                            isNationalOverviewScene
                        )
                );

        mapTransitionPromise =
            mapTransition
                .end()
                .catch(() => undefined);
    }        

    function displayStateDetails(
        pointerEvent,
        mapFeatureRow
    ) {
        if (isNationalOverviewScene) {
            return;
        }

        const stateDataRow =
            mapFeatureRow.stateDataRow;

        if (stateDataRow === undefined) {
            return;
        }

        visualizationState.hoveredState =
            stateDataRow.fipsCode;

        statePathSelection.classed(
            "hovered",
            (candidateFeatureRow) =>
                candidateFeatureRow
                    .stateFeature.id
                === stateDataRow.fipsCode
        );

        showStateTooltip(
            pointerEvent,
            stateDataRow,
            nationalDataRow,
            stateRankByFips.get(
                stateDataRow.fipsCode
            )
        );
    }

    function clearStateDetails() {
        visualizationState.hoveredState =
            null;

        statePathSelection.classed(
            "hovered",
            false
        );

        hideChartTooltip();
    }

    statePathSelection
        .on(
            "pointerenter",
            displayStateDetails
        )
        .on(
            "pointermove",
            displayStateDetails
        )
        .on(
            "pointerleave",
            clearStateDetails
        )
        .on(
            "focus",
            function (
                focusEvent,
                mapFeatureRow
            ) {
                const stateDataRow =
                    mapFeatureRow
                        .stateDataRow;

                if (
                    stateDataRow
                    === undefined
                ) {
                    return;
                }

                visualizationState
                    .hoveredState =
                    stateDataRow.fipsCode;

                statePathSelection.classed(
                    "hovered",
                    (
                        candidateFeatureRow
                    ) =>
                        candidateFeatureRow
                            .stateFeature.id
                        === stateDataRow
                            .fipsCode
                );

                chartTooltipSelection
                    .property(
                        "hidden",
                        false
                    )
                    .html(
                        `
                            <strong>
                                ${
                                    stateDataRow
                                        .stateName
                                }
                            </strong>
                            <br>
                            ${formatFullDate(
                                stateDataRow
                                    .date
                            )}
                            <br>
                            State rate:
                            ${formatRate(
                                stateDataRow
                                    .casesAveragePer100k
                            )}
                            per 100,000
                            <br>
                            National rate:
                            ${formatRate(
                                nationalDataRow
                                    .casesAveragePer100k
                            )}
                            per 100,000
                            <br>
                            State rank:
                            ${stateRankByFips.get(
                                stateDataRow
                                    .fipsCode
                            )}
                            of 51
                        `
                    );

                const statePathBounds =
                    this
                        .getBoundingClientRect();

                const syntheticPointerEvent = {
                    clientX:
                        statePathBounds.left
                        + statePathBounds.width
                            / 2,
                    clientY:
                        statePathBounds.top
                        + statePathBounds.height
                            / 2,
                };

                positionChartTooltip(
                    syntheticPointerEvent
                );
            }
        )
        .on(
            "blur",
            clearStateDetails
        )
        .on(
            "click",
            function (
                pointerEvent,
                mapFeatureRow
            ) {
                if (
                    visualizationState
                        .currentSceneIndex !== 3
                    || mapFeatureRow
                        .stateDataRow
                        === undefined
                ) {
                    return;
                }

                const clickedFipsCode =
                    mapFeatureRow
                        .stateFeature.id;

                const nextFipsCode =
                    visualizationState
                        .selectedState
                    === clickedFipsCode
                        ? null
                        : clickedFipsCode;

                applySceneFourStateSelection(
                    nextFipsCode
                );
            }
        )
        .on(
            "keydown",
            function (
                keyboardEvent,
                mapFeatureRow
            ) {
                if (
                    visualizationState
                        .currentSceneIndex !== 3
                    || mapFeatureRow
                        .stateDataRow
                        === undefined
                    || (
                        keyboardEvent.key
                            !== "Enter"
                        && keyboardEvent.key
                            !== " "
                    )
                ) {
                    return;
                }

                keyboardEvent.preventDefault();

                const selectedFipsCode =
                    mapFeatureRow
                        .stateFeature.id;

                const nextFipsCode =
                    visualizationState
                        .selectedState
                    === selectedFipsCode
                        ? null
                        : selectedFipsCode;

                applySceneFourStateSelection(
                    nextFipsCode
                );
            }
        );

    mapChartSelection
        .append("text")
        .attr(
            "class",
            "map-date-note"
        )
        .attr(
            "x",
            chartWidth - 18
        )
        .attr(
            "y",
            chartHeight - 10
        )
        .attr(
            "text-anchor",
            "end"
        )
        .text(
            isNationalOverviewScene
                ? "Geographic detail begins in Scene 2"
                : `Seven-day average on ${formatFullDate(
                    visualizationState
                        .selectedDate
                )}`
        );

    mapDateLabelSelection.text(
        isNationalOverviewScene
            ? "Geographic detail begins in Scene 2"
            : formatFullDate(
                visualizationState
                    .selectedDate
            )
    );

    return mapTransitionPromise;
}

function initializeMapResizeObserver() {
    const mapContainerNode =
        mapChartContainerSelection.node();

    if (
        mapContainerNode === null
        || mapViewState.resizeObserver
            !== null
    ) {
        return;
    }

    if (
        typeof ResizeObserver
        === "function"
    ) {
        mapViewState.resizeObserver =
            new ResizeObserver(() => {
                if (
                    mapViewState
                        .resizeAnimationFrame
                    !== null
                ) {
                    cancelAnimationFrame(
                        mapViewState
                            .resizeAnimationFrame
                    );
                }

                mapViewState
                    .resizeAnimationFrame =
                    requestAnimationFrame(
                        () => {
                            renderStateMap({
                                animateMap: false,
                            });
                        }
                    );
            });

        mapViewState.resizeObserver
            .observe(mapContainerNode);

        return;
    }

    window.addEventListener(
        "resize",
        () => {
            renderStateMap({
                animateMap: false,
            });
        }
    );
}

async function initializeVisualization() {
    if (
        typeof topojson === "undefined"
        || typeof topojson.feature
            !== "function"
    ) {
        throw new Error(
            "TopoJSON Client did not load."
        );
    }

    applicationStatusSelection
        .classed("error", false)
        .text(
            "Loading and validating visualization data…"
        );

    const [
        nationalDataRows,
        stateDataRows,
        metadata,
        stateTopology,
    ] = await Promise.all([
        d3.csv(
            DATA_PATHS.nationalData,
            parseNationalDataRow
        ),
        d3.csv(
            DATA_PATHS.stateData,
            parseStateDataRow
        ),
        d3.json(DATA_PATHS.metadata),
        d3.json(DATA_PATHS.stateTopology),
    ]);

    nationalDataRows.sort(
        (firstRow, secondRow) =>
            firstRow.date - secondRow.date
    );

    stateDataRows.sort(
        (firstRow, secondRow) => {
            const dateComparison =
                firstRow.date - secondRow.date;

            if (dateComparison !== 0) {
                return dateComparison;
            }

            return d3.ascending(
                firstRow.stateName,
                secondRow.stateName
            );
        }
    );

    const {
        stateRowsByDate,
        stateSeriesByFips,
        stateNameByFips,
        fipsCodeByStateName,
    } = createStateDataIndexes(
        stateDataRows
    );

    const validFipsCodes = new Set(
        stateNameByFips.keys()
    );

    const stateFeatures = createStateFeatures(
        stateTopology,
        validFipsCodes,
        stateNameByFips
    );

    validateLoadedData(
        nationalDataRows,
        stateDataRows,
        metadata,
        stateFeatures,
        stateRowsByDate,
        stateNameByFips
    );

    const nationalDataByDate = new Map(
        nationalDataRows.map(
            (nationalDataRow) => [
                nationalDataRow.dateKey,
                nationalDataRow,
            ]
        )
    );

    visualizationData = {
        nationalDataRows,
        nationalDataByDate,
        stateDataRows,
        stateRowsByDate,
        stateSeriesByFips,
        stateNameByFips,
        fipsCodeByStateName,
        stateFeatures,
        stateTopology,
        metadata,
    };

    initializeStateParameters(
        nationalDataRows
    );

    populateStateSelection(
        fipsCodeByStateName
    );

    renderNationalTimeline();

    initializeTimelineResizeObserver();

    initializeMapResizeObserver();

    initializeSceneTriggers();

    applyScene(0);

    applicationStatusSelection.text(
        `Loaded ${formatWholeNumber(nationalDataRows.length)} national dates, ${formatWholeNumber(stateDataRows.length)} state records, and ${stateFeatures.length} map features.`
    );

    console.log(
        "Visualization data loaded and validated."
    );

    console.table({
        "National dates":
            nationalDataRows.length,
        "State records":
            stateDataRows.length,
        "Jurisdictions":
            stateNameByFips.size,
        "Map features":
            stateFeatures.length,
        "First date":
            formatDateKey(
                nationalDataRows[0].date
            ),
        "Last date":
            formatDateKey(
                nationalDataRows[
                    nationalDataRows.length - 1
                ].date
            ),
    });

    console.log(
        "Initial visualization state:",
        visualizationState
    );

    console.log(
        "Scene definitions:",
        SCENE_DEFINITIONS
    );

    console.log(
        "Scene statistics:",
        metadata.scene_statistics
    );
}

function handleInitializationError(error) {
    applicationStatusSelection
        .classed("error", true)
        .text(
            "The visualization data could not be loaded. Check the browser console for details."
        );

    console.error(
        "Visualization initialization failed:",
        error
    );
}

initializeVisualization().catch(
    handleInitializationError
);