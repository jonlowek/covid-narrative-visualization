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
            "Use the comparison control to move between April and July without leaving this scene.",
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

const dateSliderControl = d3.select(
    "#date-slider"
);

const selectedDateOutputSelection = d3.select(
    "#selected-date-output"
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
                Case rate:
                ${formatRate(
                    nationalDataRow
                        .casesAveragePer100k
                )}
                per 100,000
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

    const dateExtent = d3.extent(
        nationalDataRows,
        (nationalDataRow) =>
            nationalDataRow.date
    );

    const maximumCaseRate = d3.max(
        nationalDataRows,
        (nationalDataRow) =>
            nationalDataRow
                .casesAveragePer100k
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

function renderStateMap() {
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
                        mapFeatureRow
                            .stateDataRow
                        === undefined
                    ) {
                        return "#e5e7eb";
                    }

                    return mapColorScale(
                        mapFeatureRow
                            .stateDataRow
                            .casesAveragePer100k
                    );
                }
            )
            .attr("tabindex", 0)
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

    function displayStateDetails(
        pointerEvent,
        mapFeatureRow
    ) {
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
            `Seven-day average on ${formatFullDate(
                visualizationState
                    .selectedDate
            )}`
        );

    mapDateLabelSelection.text(
        formatFullDate(
            visualizationState.selectedDate
        )
    );
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
                        renderStateMap
                    );
            });

        mapViewState.resizeObserver
            .observe(mapContainerNode);

        return;
    }

    window.addEventListener(
        "resize",
        renderStateMap
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

    renderStateMap();

    initializeTimelineResizeObserver();

    initializeMapResizeObserver();

    interactionGuidanceSelection.text(
        SCENE_DEFINITIONS[0]
            .interactionGuidance
    );

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