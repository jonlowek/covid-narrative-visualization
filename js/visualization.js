"use strict";

const applicationStatusElement = d3.select("#application-status");

applicationStatusElement.text(
    `D3 version ${d3.version} loaded successfully.`
);

console.log(`D3 version ${d3.version} loaded successfully.`);