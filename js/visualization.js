"use strict";

const applicationStatusSelection = d3.select(
    "#application-status"
);

const d3Version = d3.version;

const topojsonClientAvailable =
    typeof topojson !== "undefined"
    && typeof topojson.feature === "function";

if (topojsonClientAvailable) {
    applicationStatusSelection.text(
        `D3 version ${d3Version} and TopoJSON Client loaded successfully.`
    );

    console.log(
        `D3 version ${d3Version} loaded successfully.`
    );

    console.log(
        "TopoJSON Client loaded successfully."
    );
} else {
    applicationStatusSelection
        .classed("error", true)
        .text(
            "TopoJSON Client did not load. Check the browser console."
        );

    console.error(
        "TopoJSON Client was not available."
    );
}