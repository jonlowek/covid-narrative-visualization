from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import median


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
RAW_DATA_DIRECTORY = REPOSITORY_ROOT / "data" / "raw"
OUTPUT_DATA_DIRECTORY = REPOSITORY_ROOT / "data"

RAW_NATIONAL_FILE = RAW_DATA_DIRECTORY / "us.csv"
RAW_STATE_FILE = RAW_DATA_DIRECTORY / "us-states.csv"

PROCESSED_NATIONAL_FILE = OUTPUT_DATA_DIRECTORY / "us-rolling.csv"
PROCESSED_STATE_FILE = OUTPUT_DATA_DIRECTORY / "states-rolling.csv"
METADATA_FILE = OUTPUT_DATA_DIRECTORY / "metadata.json"

NATIONAL_SOURCE_URL = (
    "https://raw.githubusercontent.com/nytimes/covid-19-data/"
    "master/rolling-averages/us.csv"
)

STATE_SOURCE_URL = (
    "https://raw.githubusercontent.com/nytimes/covid-19-data/"
    "master/rolling-averages/us-states.csv"
)

STATE_AND_DISTRICT_NAMES = {
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "District of Columbia",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
}

SCENE_DATES = (
    "2020-04-10",
    "2020-07-25",
    "2022-01-14",
)

REQUIRED_NATIONAL_COLUMNS = {
    "date",
    "geoid",
    "cases",
    "cases_avg",
    "cases_avg_per_100k",
    "deaths",
    "deaths_avg",
    "deaths_avg_per_100k",
}

REQUIRED_STATE_COLUMNS = {
    "date",
    "geoid",
    "state",
    "cases",
    "cases_avg",
    "cases_avg_per_100k",
    "deaths",
    "deaths_avg",
    "deaths_avg_per_100k",
}


def read_csv_file(file_path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not file_path.exists():
        raise FileNotFoundError(
            f"Required source file was not found: {file_path}"
        )

    with file_path.open(
        mode="r",
        encoding="utf-8-sig",
        newline="",
    ) as source_file:
        csv_reader = csv.DictReader(source_file)

        if csv_reader.fieldnames is None:
            raise ValueError(f"No header row was found in {file_path}")

        field_names = list(csv_reader.fieldnames)
        rows = list(csv_reader)

    return field_names, rows


def validate_required_columns(
    file_path: Path,
    actual_columns: list[str],
    required_columns: set[str],
) -> None:
    missing_columns = required_columns.difference(actual_columns)

    if missing_columns:
        missing_column_text = ", ".join(sorted(missing_columns))
        raise ValueError(
            f"{file_path} is missing required columns: "
            f"{missing_column_text}"
        )


def parse_required_float(
    raw_value: str,
    column_name: str,
    row_description: str,
) -> float:
    if raw_value is None or raw_value.strip() == "":
        raise ValueError(
            f"Missing {column_name} value for {row_description}"
        )

    try:
        return float(raw_value)
    except ValueError as error:
        raise ValueError(
            f"Invalid {column_name} value for {row_description}: "
            f"{raw_value}"
        ) from error


def write_csv_file(
    file_path: Path,
    field_names: list[str],
    rows: list[dict[str, str]],
) -> None:
    with file_path.open(
        mode="w",
        encoding="utf-8",
        newline="",
    ) as output_file:
        csv_writer = csv.DictWriter(
            output_file,
            fieldnames=field_names,
            lineterminator="\n",
        )

        csv_writer.writeheader()
        csv_writer.writerows(rows)


def main() -> None:
    OUTPUT_DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)

    national_columns, raw_national_rows = read_csv_file(
        RAW_NATIONAL_FILE
    )

    state_columns, raw_state_rows = read_csv_file(
        RAW_STATE_FILE
    )

    validate_required_columns(
        RAW_NATIONAL_FILE,
        national_columns,
        REQUIRED_NATIONAL_COLUMNS,
    )

    validate_required_columns(
        RAW_STATE_FILE,
        state_columns,
        REQUIRED_STATE_COLUMNS,
    )

    processed_national_rows: list[dict[str, str]] = []

    for source_row in raw_national_rows:
        if source_row["geoid"] != "USA":
            continue

        processed_national_rows.append(
            {
                "date": source_row["date"],
                "cases_avg": source_row["cases_avg"],
                "cases_avg_per_100k": source_row[
                    "cases_avg_per_100k"
                ],
                "deaths_avg": source_row["deaths_avg"],
                "deaths_avg_per_100k": source_row[
                    "deaths_avg_per_100k"
                ],
            }
        )

    processed_national_rows.sort(
        key=lambda row: row["date"]
    )

    processed_state_rows: list[dict[str, str]] = []

    for source_row in raw_state_rows:
        state_name = source_row["state"].strip()

        if state_name not in STATE_AND_DISTRICT_NAMES:
            continue

        geoid = source_row["geoid"].strip()
        geoid_parts = geoid.split("-")
        fips_code = geoid_parts[-1]

        if (
            len(geoid_parts) != 2
            or len(fips_code) != 2
            or not fips_code.isdigit()
        ):
            raise ValueError(
                f"Unexpected state geoid for {state_name}: {geoid}"
            )

        processed_state_rows.append(
            {
                "date": source_row["date"],
                "fips": fips_code,
                "state": state_name,
                "cases_avg_per_100k": source_row[
                    "cases_avg_per_100k"
                ],
                "deaths_avg_per_100k": source_row[
                    "deaths_avg_per_100k"
                ],
            }
        )

    processed_state_rows.sort(
        key=lambda row: (
            row["date"],
            row["state"],
        )
    )

    observed_jurisdictions = {
        row["state"] for row in processed_state_rows
    }

    state_fips_by_name: dict[str, str] = {}
    first_recorded_date_by_state: dict[str, str] = {}
    state_rows_by_date_and_name: dict[
        tuple[str, str],
        dict[str, str],
    ] = {}

    for state_row in processed_state_rows:
        state_name = state_row["state"]
        state_date = state_row["date"]
        state_key = (state_date, state_name)

        if state_key in state_rows_by_date_and_name:
            raise ValueError(
                f"Duplicate state record for "
                f"{state_name} on {state_date}"
            )

        state_rows_by_date_and_name[state_key] = state_row
        state_fips_by_name[state_name] = state_row["fips"]

        if (
            state_name not in first_recorded_date_by_state
            or state_date
            < first_recorded_date_by_state[state_name]
        ):
            first_recorded_date_by_state[
                state_name
            ] = state_date

    missing_jurisdictions = (
        STATE_AND_DISTRICT_NAMES - observed_jurisdictions
    )

    unexpected_jurisdictions = (
        observed_jurisdictions - STATE_AND_DISTRICT_NAMES
    )

    if missing_jurisdictions:
        missing_text = ", ".join(
            sorted(missing_jurisdictions)
        )
        raise ValueError(
            f"Expected jurisdictions are missing: {missing_text}"
        )

    if unexpected_jurisdictions:
        unexpected_text = ", ".join(
            sorted(unexpected_jurisdictions)
        )
        raise ValueError(
            f"Unexpected jurisdictions were retained: "
            f"{unexpected_text}"
        )
    
    national_dates = [
        row["date"]
        for row in processed_national_rows
    ]

    completed_state_rows: list[
        dict[str, str]
    ] = []

    filled_leading_zero_record_count = 0

    for national_date in national_dates:
        for state_name in sorted(
            STATE_AND_DISTRICT_NAMES
        ):
            state_key = (
                national_date,
                state_name,
            )

            existing_state_row = (
                state_rows_by_date_and_name.get(
                    state_key
                )
            )

            if existing_state_row is not None:
                completed_state_rows.append(
                    existing_state_row
                )
                continue

            first_recorded_date = (
                first_recorded_date_by_state[
                    state_name
                ]
            )

            if national_date < first_recorded_date:
                completed_state_rows.append(
                    {
                        "date": national_date,
                        "fips": state_fips_by_name[
                            state_name
                        ],
                        "state": state_name,
                        "cases_avg_per_100k": "0",
                        "deaths_avg_per_100k": "0",
                    }
                )

                filled_leading_zero_record_count += 1
                continue

            raise ValueError(
                f"Missing record for {state_name} "
                f"on {national_date} after its "
                f"first source record on "
                f"{first_recorded_date}"
            )

    processed_state_rows = completed_state_rows

    expected_state_record_count = (
        len(processed_national_rows)
        * len(STATE_AND_DISTRICT_NAMES)
    )

    if (
        len(processed_state_rows)
        != expected_state_record_count
    ):
        raise ValueError(
            "Completed state dataset has "
            f"{len(processed_state_rows):,} records; "
            f"expected "
            f"{expected_state_record_count:,}"
        )

    write_csv_file(
        PROCESSED_NATIONAL_FILE,
        [
            "date",
            "cases_avg",
            "cases_avg_per_100k",
            "deaths_avg",
            "deaths_avg_per_100k",
        ],
        processed_national_rows,
    )

    write_csv_file(
        PROCESSED_STATE_FILE,
        [
            "date",
            "fips",
            "state",
            "cases_avg_per_100k",
            "deaths_avg_per_100k",
        ],
        processed_state_rows,
    )

    national_rows_by_date = {
        row["date"]: row
        for row in processed_national_rows
    }

    state_rows_by_date: dict[
        str,
        list[dict[str, str]],
    ] = defaultdict(list)

    for state_row in processed_state_rows:
        state_rows_by_date[state_row["date"]].append(
            state_row
        )

    scene_statistics: dict[str, dict[str, object]] = {}

    for scene_date in SCENE_DATES:
        if scene_date not in national_rows_by_date:
            raise ValueError(
                f"No national record exists for {scene_date}"
            )

        scene_state_rows = state_rows_by_date.get(
            scene_date,
            [],
        )

        scene_state_rates: list[
            tuple[str, float]
        ] = []

        for scene_state_row in scene_state_rows:
            state_rate = parse_required_float(
                scene_state_row["cases_avg_per_100k"],
                "cases_avg_per_100k",
                (
                    f"{scene_state_row['state']} on "
                    f"{scene_date}"
                ),
            )

            scene_state_rates.append(
                (
                    scene_state_row["state"],
                    state_rate,
                )
            )

        if len(scene_state_rates) != 51:
            raise ValueError(
                f"Expected 51 state and district records on "
                f"{scene_date}, but found "
                f"{len(scene_state_rates)}"
            )

        scene_state_rates.sort(
            key=lambda item: item[1],
            reverse=True,
        )

        state_rate_values = [
            rate for _, rate in scene_state_rates
        ]

        national_rate = parse_required_float(
            national_rows_by_date[scene_date][
                "cases_avg_per_100k"
            ],
            "cases_avg_per_100k",
            f"the United States on {scene_date}",
        )

        scene_statistics[scene_date] = {
            "national_cases_avg_per_100k": round(
                national_rate,
                2,
            ),
            "median_state_cases_avg_per_100k": round(
                median(state_rate_values),
                2,
            ),
            "jurisdictions_above_25": sum(
                rate > 25
                for rate in state_rate_values
            ),
            "jurisdictions_above_50": sum(
                rate > 50
                for rate in state_rate_values
            ),
            "jurisdictions_above_100": sum(
                rate > 100
                for rate in state_rate_values
            ),
            "top_states": [
                {
                    "state": state_name,
                    "cases_avg_per_100k": round(
                        state_rate,
                        2,
                    ),
                }
                for state_name, state_rate
                in scene_state_rates[:5]
            ],
        }

    metadata = {
        "title": "One Curve, Fifty Outbreaks",
        "generated_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "source": {
            "publisher": "The New York Times",
            "repository": (
                "https://github.com/nytimes/"
                "covid-19-data"
            ),
            "national_file": NATIONAL_SOURCE_URL,
            "state_file": STATE_SOURCE_URL,
            "archive_end_date": "2023-03-23",
        },
        "scope": {
            "national_series": "United States",
            "map_jurisdictions": (
                "50 states and the District of Columbia"
            ),
            "jurisdiction_count": len(
                observed_jurisdictions
            ),
        },
        "records": {
            "national": len(
                processed_national_rows
            ),
            "states_and_district": len(
                processed_state_rows
            ),
            "filled_leading_zero_records": (
                filled_leading_zero_record_count
            ),
        },
        "date_ranges": {
            "national": {
                "start": processed_national_rows[0][
                    "date"
                ],
                "end": processed_national_rows[-1][
                    "date"
                ],
            },
            "states_and_district": {
                "start": processed_state_rows[0][
                    "date"
                ],
                "end": processed_state_rows[-1][
                    "date"
                ],
            },
        },
        "scene_statistics": scene_statistics,
    }

    with METADATA_FILE.open(
        mode="w",
        encoding="utf-8",
    ) as metadata_output_file:
        json.dump(
            metadata,
            metadata_output_file,
            indent=2,
        )
        metadata_output_file.write("\n")

    print(
        f"Prepared {len(processed_national_rows):,} "
        f"national records."
    )

    print(
        f"Prepared {len(processed_state_rows):,} "
        f"state and district records."
    )

    print(
        f"Retained {len(observed_jurisdictions)} "
        f"jurisdictions."
    )

    print(
        f"Filled {filled_leading_zero_record_count:,} "
        "leading state-date records with zero."
    )

    print(
        "National date range: "
        f"{metadata['date_ranges']['national']['start']} "
        "to "
        f"{metadata['date_ranges']['national']['end']}"
    )

    print(
        "State date range: "
        f"{metadata['date_ranges']['states_and_district']['start']} "
        "to "
        f"{metadata['date_ranges']['states_and_district']['end']}"
    )

    for scene_date, statistics in scene_statistics.items():
        top_state = statistics["top_states"][0]

        print(
            f"{scene_date}: national rate "
            f"{statistics['national_cases_avg_per_100k']}, "
            f"highest state {top_state['state']} "
            f"at {top_state['cases_avg_per_100k']}"
        )

    print(
        f"Wrote {PROCESSED_NATIONAL_FILE.relative_to(REPOSITORY_ROOT)}"
    )

    print(
        f"Wrote {PROCESSED_STATE_FILE.relative_to(REPOSITORY_ROOT)}"
    )

    print(
        f"Wrote {METADATA_FILE.relative_to(REPOSITORY_ROOT)}"
    )


if __name__ == "__main__":
    main()