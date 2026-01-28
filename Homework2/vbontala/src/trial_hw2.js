import * as d3 from "d3";


// Dashboard Container

export const Charts = () => `
  <h1 id="main-heading">Spotify Dataset Dashboard</h1>
  <p id="dashboard-description">
    This dashboard explores how popular music has evolved from 1950 to 2025 through three lenses: 
    <strong>artist success, lyrical content maturity, and genre dominance</strong>. Together, 
    these views provide a multi-level perspective on how music and audience preferences have transformed over time.
  </p>
  <div class="charts-wrapper">
    <div class="chart-wrapper">
      <div class="chart-container" id="scatter-container">
        <svg id="scatter-svg"></svg>
      </div>
      <div class="chart-container" id="explicit-container">
        <svg id="explicit-svg"></svg>
      </div>
    </div>

    <div class="chart-wrapper">
      <div class="chart-container full-width" id="stream-container">
        <svg id="stream-svg"></svg>
      </div>
    </div>
  </div>
`;


// Mount charts

export async function mountCharts() {
  const data = await d3.csv("./data/spotify_data_clean.csv", d => {
    let explicitValue;
    if (d.explicit === "true" || d.explicit === "True" || d.explicit === "TRUE" || d.explicit === "1") {
      explicitValue = true;
    } else if (d.explicit === "false" || d.explicit === "False" || d.explicit === "FALSE" || d.explicit === "0" || d.explicit === "") {
      explicitValue = false;
    } else {
      explicitValue = false;
    }

    return {
      artist_followers: +d.artist_followers,
      artist_popularity: +d.artist_popularity,
      explicit: explicitValue,
      genres: d.artist_genres ? d.artist_genres.split(",").map(g => g.trim()) : [],
      year: d.album_release_date ? +d.album_release_date.slice(0, 4) : null
    };
  }).then(d =>
    d.filter(
      x =>
        x.year &&
        x.year >= 1950 &&
        x.year <= 2025 &&
        x.artist_followers > 0
    )
  );

  console.log("Total tracks:", data.length);
  console.log("Explicit tracks:", data.filter(d => d.explicit === true).length);
  console.log("Non-explicit tracks:", data.filter(d => d.explicit === false).length);

  drawScatter(data);
  drawExplicitStacked(data);
  drawStreamgraph(data);
}


// Scatter Plot

function drawScatter(data) {
  const svg = d3.select("#scatter-svg");
  const container = document.querySelector("#scatter-container");

  const margin = { top: 70, right: 40, bottom: 70, left: 80 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = container.clientHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${container.clientWidth} ${container.clientHeight}`);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLog()
    .domain([1, d3.max(data, d => d.artist_followers)])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([height, 0]);

  // X-axis
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6, "~s"));

  // Y-axis
  g.append("g").call(d3.axisLeft(y));

  
  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(d.artist_followers))
    .attr("cy", d => y(d.artist_popularity))
    .attr("r", 3)
    .attr("fill", "#1db954")
    .attr("opacity", 0.6);

  // Title
  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .text("Artist Popularity vs Audience Reach");

  
  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 38)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#666")
    .text("Strong positive correlation: higher follower counts typically align with greater popularity");

  // X-axis label
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Artist Followers (log scale)");

  // Y-axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -55)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Artist Popularity");
}


// Explicit vs Non-Explicit Tracks

function drawExplicitStacked(data) {
  const svg = d3.select("#explicit-svg");
  const container = document.querySelector("#explicit-container");

  const margin = { top: 70, right: 70, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = container.clientHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${container.clientWidth} ${container.clientHeight}`);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  
  const yearly = d3.rollups(
    data,
    v => {
      const explicitCount = v.filter(d => d.explicit === true).length;
      const nonExplicitCount = v.filter(d => d.explicit === false).length;
      const total = explicitCount + nonExplicitCount;
      return {
        explicit: explicitCount,
        nonExplicit: nonExplicitCount,
        pctExplicit: total > 0 ? explicitCount / total : 0
      };
    },
    d => d.year
  )
    .map(([year, d]) => ({
      year: +year,
      explicit: d.explicit,
      nonExplicit: d.nonExplicit,
      pctExplicit: d.pctExplicit
    }))
    .sort((a, b) => a.year - b.year);

  // Scales
  const x = d3.scaleBand()
    .domain(yearly.map(d => d.year))
    .range([0, width])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(yearly, d => d.explicit + d.nonExplicit)])
    .nice()
    .range([height, 0]);

  const yRight = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(["nonExplicit", "explicit"])
    .range(["#4e79a7", "#e15759"]);

  // Stack
  const stack = d3.stack().keys(["nonExplicit", "explicit"]);
  const series = stack(yearly);

  g.selectAll(".layer")
    .data(series)
    .join("g")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .selectAll("rect")
    .data(d => d)
    .join("rect")
    .attr("x", d => x(d.data.year))
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth());

  // Axes
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(x.domain().filter(y => y % 5 === 0))
    );

  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y));

  g.append("g")
    .attr("class", "y-axis-right")
    .attr("transform", `translate(${width},0)`)
    .call(
      d3.axisRight(yRight)
        .ticks(5)
        .tickFormat(d3.format(".0%"))
    );

  // Trend Line (% Explicit)
  const line = d3.line()
    .x(d => x(d.year) + x.bandwidth() / 2)
    .y(d => yRight(d.pctExplicit));

  g.append("path")
    .datum(yearly)
    .attr("class", "trend-line")
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Title
  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .text("The Rise of Explicit Content in Music (1950–2025)");

  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 38)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#666")
    .text("Dramatic surge in explicit content post-2000, with nearly 50% of recent tracks containing explicit lyrics");

  // X-axis label
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Year");

  // Y-axis label (left)
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Number of Tracks");

  // Y-axis label (right)
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", width + 60)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("% Explicit");

  // Legend (Inside chart, top-left)
  const legend = g.append("g")
    .attr("transform", `translate(10, 10)`);

  legend.append("rect")
    .attr("x", -5)
    .attr("y", -5)
    .attr("width", 260)
    .attr("height", 30)
    .attr("fill", "white")
    .attr("opacity", 0.9)
    .attr("rx", 3);

  ["nonExplicit", "explicit"].forEach((k, i) => {
    legend.append("rect")
      .attr("x", i * 130)
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", color(k));

    legend.append("text")
      .attr("x", i * 130 + 20)
      .attr("y", 12)
      .text(k === "explicit" ? "Explicit" : "Non-Explicit")
      .style("font-size", "12px");
  });
}


// Streamgraph
function drawStreamgraph(data) {
  const svg = d3.select("#stream-svg");
  const container = document.querySelector("#stream-container");

  const margin = { top: 70, right: 140, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = container.clientHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${container.clientWidth} ${container.clientHeight}`);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const flat = [];
  data.forEach(d =>
    d.genres.forEach(g => {
      
      if (g && g !== "N/A" && g !== "n/a") {
        flat.push({ year: d.year, genre: g });
      }
    })
  );

  const topGenres = Array.from(
    d3.rollup(flat, v => v.length, d => d.genre),
    ([g, c]) => ({ g, c })
  )
    .sort((a, b) => b.c - a.c)
    .slice(0, 7)
    .map(d => d.g);

  const years = d3.groups(flat, d => d.year).map(d => d[0]).sort(d3.ascending);

  const stackedData = years.map(y => {
    const row = { year: y };
    topGenres.forEach(g => {
      row[g] = flat.filter(d => d.year === y && d.genre === g).length;
    });
    return row;
  });

  const stack = d3.stack().keys(topGenres).offset(d3.stackOffsetWiggle);
  const series = stack(stackedData);

  
  const x = d3.scaleLinear()
    .domain([1950, 2025])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(series, s => d3.min(s, d => d[0])),
      d3.max(series, s => d3.max(s, d => d[1]))
    ])
    .range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(topGenres);

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveBasis);

  g.selectAll("path")
    .data(series)
    .join("path")
    .attr("d", area)
    .attr("fill", d => color(d.key));

  // X-axis with explicit ticks
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickFormat(d3.format("d"))
        .ticks(8)
    );

  // Title
  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .text("Shifting Genre Dominance Across Eras");

  // Subtitle/Annotation
  svg.append("text")
    .attr("x", container.clientWidth / 2)
    .attr("y", 38)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#666")
    .text("Sparse early decades transition to rich post-2000 data, revealing hip-hop's explosive growth and increasing genre diversity");

  // X-axis label
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Year");

  // Legend
  const legend = svg.append("g")
    .attr(
      "transform",
      `translate(${margin.left + width + 10},${margin.top})`
    );

  topGenres.forEach((g, i) => {
    legend.append("rect")
      .attr("y", i * 18)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", color(g));

    legend.append("text")
      .attr("x", 18)
      .attr("y", i * 18 + 10)
      .text(g)
      .style("font-size", "12px");
  });
}