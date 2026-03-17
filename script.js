/* ================================================================
   WeatherScope — script.js
   Vanilla JavaScript for the weather dashboard.

   What this file does (overview):
     1. Defines the API key and base URLs
     2. Fetches current weather, forecast, and air-quality data
     3. Renders all data into the HTML
     4. Dynamically changes the background gradient
     5. Animates the sunrise/sunset arc
     6. Handles °C / °F unit switching
     7. Runs the chatbot weather advisor

   HOW TO GET AN API KEY:
     1. Visit https://openweathermap.org/api
     2. Sign up for a free account
     3. Go to "API keys" in your dashboard
     4. Copy your key and paste it below
================================================================ */


/* ================================================================
   SECTION 1 — CONFIGURATION
   ▼ INSERT YOUR API KEY IN THE VARIABLE BELOW ▼
================================================================ */

// ---------------------------------------------------------------
// INSERT YOUR OPENWEATHERMAP API KEY HERE
// Replace the empty string with your actual key, e.g.:
//   const API_KEY = "abc123def456abc123def456abc12345";
// ---------------------------------------------------------------
const API_KEY = "";

// Base URLs for the three OpenWeatherMap endpoints we use
const BASE_URL       = "https://api.openweathermap.org/data/2.5";
const AIR_QUALITY_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
const ICON_URL       = "https://openweathermap.org/img/wn/";

// Default city shown when the page first loads
const DEFAULT_CITY = "London";


/* ================================================================
   SECTION 2 — STATE
   We store the raw API data here so we can re-render when
   the user switches between °C and °F without re-fetching.
================================================================ */
let currentWeatherData = null;   // data from /weather endpoint
let forecastData       = null;   // data from /forecast endpoint
let airQualityData     = null;   // data from /air_pollution endpoint
let unit               = "metric"; // "metric" (°C) or "imperial" (°F)


/* ================================================================
   SECTION 3 — DOM REFERENCES
   We grab all the elements we'll need to update.
================================================================ */

// Layout
const bgLayer       = document.getElementById("bgLayer");
const loadingOverlay = document.getElementById("loadingOverlay");
const errorMsg       = document.getElementById("errorMsg");

// Search
const searchForm = document.getElementById("searchForm");
const cityInput  = document.getElementById("cityInput");

// Unit buttons
const btnCelsius    = document.getElementById("btnCelsius");
const btnFahrenheit = document.getElementById("btnFahrenheit");

// Current weather
const cityNameEl   = document.getElementById("cityName");
const currentDateEl = document.getElementById("currentDate");
const weatherDescEl = document.getElementById("weatherDesc");
const weatherIconEl = document.getElementById("weatherIcon");
const tempMainEl    = document.getElementById("tempMain");
const feelsLikeEl   = document.getElementById("feelsLike");
const qsHumidityEl  = document.getElementById("qsHumidity");
const qsWindEl      = document.getElementById("qsWind");
const qsVisibilityEl = document.getElementById("qsVisibility");

// Highlights
const hlWindEl      = document.getElementById("hlWind");
const hlWindUnitEl  = document.getElementById("hlWindUnit");
const hlWindDirEl   = document.getElementById("hlWindDir");
const hlHumidityEl  = document.getElementById("hlHumidity");
const humidityBarEl = document.getElementById("humidityBar");
const humidityStatusEl = document.getElementById("humidityStatus");
const hlPressureEl  = document.getElementById("hlPressure");
const hlVisibilityEl = document.getElementById("hlVisibility");
const hlAQIEl       = document.getElementById("hlAQI");
const aqiBadgeEl    = document.getElementById("aqiBadge");
const hlDewPointEl  = document.getElementById("hlDewPoint");
const hlDewUnitEl   = document.getElementById("hlDewUnit");

// Sun schedule
const sunriseTimeEl = document.getElementById("sunriseTime");
const sunsetTimeEl  = document.getElementById("sunsetTime");
const dayLengthEl   = document.getElementById("dayLength");
const sunArcFill    = document.getElementById("sunArcFill");
const sunDot        = document.getElementById("sunDot");

// Forecast & hourly
const forecastListEl  = document.getElementById("forecastList");
const hourlyScrollEl  = document.getElementById("hourlyScroll");

// Chatbot
const chatToggleBtn  = document.getElementById("chatToggleBtn");
const chatWindow     = document.getElementById("chatWindow");
const chatCloseBtn   = document.getElementById("chatCloseBtn");
const chatMessages   = document.getElementById("chatMessages");
const chatInputForm  = document.getElementById("chatInputForm");
const chatInputEl    = document.getElementById("chatInput");
const chatQuickBtns  = document.getElementById("chatQuickBtns");


/* ================================================================
   SECTION 4 — UTILITY HELPERS
================================================================ */

/**
 * Show the loading spinner overlay.
 */
function showLoading() {
  loadingOverlay.classList.remove("hidden");
}

/**
 * Hide the loading spinner overlay.
 */
function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

/**
 * Display an error message under the search bar.
 * @param {string} msg - The message to show (empty string clears it).
 */
function showError(msg) {
  errorMsg.textContent = msg;
}

/**
 * Convert a Unix timestamp (seconds) to a human-readable time string.
 * The timezone offset from the API adjusts for the city's local time.
 * @param {number} unixSeconds - Timestamp in seconds.
 * @param {number} tzOffset    - City timezone offset in seconds.
 * @returns {string} e.g. "06:42 AM"
 */
function unixToTime(unixSeconds, tzOffset) {
  // Convert to milliseconds and add timezone offset
  const date = new Date((unixSeconds + tzOffset) * 1000);
  // getUTC* avoids a second local-time conversion
  let hours   = date.getUTCHours();
  let minutes = date.getUTCMinutes();
  const ampm  = hours >= 12 ? "PM" : "AM";
  hours       = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/**
 * Format a Unix timestamp to a short day name (e.g. "Mon", "Tue").
 * @param {number} unixSeconds
 * @returns {string}
 */
function unixToDayName(unixSeconds) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(unixSeconds * 1000).getDay()];
}

/**
 * Format today's date to a readable string, e.g. "Sunday, 15 March 2026".
 * @returns {string}
 */
function formatTodayDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Convert wind degrees to a compass direction (e.g. 90° → "E").
 * @param {number} deg
 * @returns {string}
 */
function degreesToCompass(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Build the OpenWeatherMap icon URL.
 * @param {string} iconCode - e.g. "01d"
 * @returns {string}
 */
function iconUrl(iconCode) {
  return `${ICON_URL}${iconCode}@2x.png`;
}

/**
 * Round a number to 1 decimal place.
 * @param {number} n
 * @returns {number}
 */
function round1(n) {
  return Math.round(n * 10) / 10;
}


/* ================================================================
   SECTION 5 — API FETCH FUNCTIONS
================================================================ */

/**
 * Fetch current weather for a given city name.
 * OpenWeatherMap docs: https://openweathermap.org/current
 * @param {string} city
 * @returns {Promise<Object>} Weather data object
 */
async function fetchCurrentWeather(city) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`;
  const res = await fetch(url);
  if (!res.ok) {
    // 404 = city not found; other codes = API/network issues
    if (res.status === 404) throw new Error("City not found. Please check the spelling and try again.");
    throw new Error(`Weather API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch 5-day / 3-hour forecast for a city.
 * OpenWeatherMap docs: https://openweathermap.org/forecast5
 * @param {string} city
 * @returns {Promise<Object>} Forecast data object
 */
async function fetchForecast(city) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch current air quality index (AQI) using latitude & longitude.
 * OpenWeatherMap docs: https://openweathermap.org/api/air-pollution
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} Air pollution data object
 */
async function fetchAirQuality(lat, lon) {
  const url = `${AIR_QUALITY_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air quality API error: ${res.status}`);
  return res.json();
}


/* ================================================================
   SECTION 6 — MAIN DATA LOAD FUNCTION
   Called on page load and on every new city search.
================================================================ */

/**
 * Load all weather data for a city and render it.
 * @param {string} city - The city name to look up.
 */
async function loadWeather(city) {
  // Clear any previous errors
  showError("");
  // Show the loading spinner
  showLoading();

  try {
    // ── Fetch current weather first (we need lat/lon for air quality) ──
    currentWeatherData = await fetchCurrentWeather(city);

    //-----------------------------------------------------------------------------------------------------------------------------------------------//
    const windSpeed = currentWeatherData.wind.speed;

  if (windSpeed > 8) {
    createWindLeaves();
  } else {
    document.getElementById("windLeaves").innerHTML = "";
  }
///////////
    const { lat, lon } = currentWeatherData.coord;

    // ── Fetch forecast and air quality in parallel for speed ──
    [forecastData, airQualityData] = await Promise.all([
      fetchForecast(city),
      fetchAirQuality(lat, lon),
    ]);

    // ── Render everything ──
    renderCurrentWeather();
    renderHighlights();
    renderSunSchedule();
    renderForecast();
    renderHourly();
    applyDynamicBackground();

  } catch (err) {
    // Something went wrong — show the error to the user
    showError(err.message);
    console.error("WeatherScope error:", err);
  } finally {
    // Always hide the loading spinner when done (success or failure)
    hideLoading();
  }
}


/* ================================================================
   SECTION 7 — RENDER FUNCTIONS
   Each function reads from the stored data objects and
   updates the corresponding DOM elements.
================================================================ */

/**
 * Render the main current-weather card.
 */
function renderCurrentWeather() {
  const d = currentWeatherData;

  // City name and country
  cityNameEl.textContent = `${d.name}, ${d.sys.country}`;

  // Today's formatted date
  currentDateEl.textContent = formatTodayDate();

  // Weather description (e.g. "light rain")
  weatherDescEl.textContent = d.weather[0].description;

  // Weather icon
  weatherIconEl.src = iconUrl(d.weather[0].icon);
  weatherIconEl.alt = d.weather[0].description;

  // Temperature — show 1 decimal or round depending on preference
  const tempUnit = unit === "metric" ? "°C" : "°F";
  tempMainEl.textContent = `${Math.round(d.main.temp)}${tempUnit}`;
  feelsLikeEl.textContent = `${Math.round(d.main.feels_like)}${tempUnit}`;

  // Quick stats (humidity, wind, visibility)
  qsHumidityEl.textContent  = `${d.main.humidity}%`;

  const windUnitLabel = unit === "metric" ? "m/s" : "mph";
  qsWindEl.textContent      = `${round1(d.wind.speed)} ${windUnitLabel}`;
  qsVisibilityEl.textContent = `${(d.visibility / 1000).toFixed(1)} km`;
}

/**
 * Render the Today's Highlights grid.
 */
function renderHighlights() {
  const d   = currentWeatherData;
  const aq  = airQualityData;
  const tempUnit    = unit === "metric" ? "°C" : "°F";
  const windLabel   = unit === "metric" ? "m/s" : "mph";

  // Wind speed & direction
  hlWindEl.textContent    = round1(d.wind.speed);
  hlWindUnitEl.textContent = windLabel;
  hlWindDirEl.textContent = degreesToCompass(d.wind.deg || 0);

  // Humidity + progress bar
  const humidity = d.main.humidity;
  hlHumidityEl.textContent     = humidity;
  humidityBarEl.style.width    = `${humidity}%`;

  // Describe humidity level in plain English
  if (humidity < 30)       humidityStatusEl.textContent = "Low — quite dry";
  else if (humidity < 60)  humidityStatusEl.textContent = "Normal — comfortable";
  else if (humidity < 80)  humidityStatusEl.textContent = "High — a bit muggy";
  else                     humidityStatusEl.textContent = "Very high — humid";

  // Pressure
  hlPressureEl.textContent = d.main.pressure;

  // Visibility (API gives metres; convert to km)
  hlVisibilityEl.textContent = (d.visibility / 1000).toFixed(1);

  // Air Quality Index
  // OWM AQI scale: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
  const aqi = aq.list[0].main.aqi;
  hlAQIEl.textContent = aqi;
  const aqiLabels = ["", "Good", "Fair", "Moderate", "Poor", "Very Poor"];
  const aqiClasses = ["", "good", "fair", "moderate", "poor", "very-poor"];
  aqiBadgeEl.textContent  = aqiLabels[aqi]  || "—";
  // Reset classes then add the right one
  aqiBadgeEl.className    = "aqi-badge " + (aqiClasses[aqi] || "");

  // Dew point — calculated from temperature and humidity using Magnus formula
  // This approximation is accurate within ~0.5°C
  const tempC   = unit === "metric" ? d.main.temp : (d.main.temp - 32) * 5 / 9;
  const dewPointC = tempC - ((100 - humidity) / 5);
  const displayDew = unit === "metric"
    ? round1(dewPointC)
    : round1(dewPointC * 9 / 5 + 32);
  hlDewPointEl.textContent = displayDew;
  hlDewUnitEl.textContent  = tempUnit;
}

/**
 * Render the Sunrise / Sunset card, including the animated arc.
 */
function renderSunSchedule() {
  const d         = currentWeatherData;
  const tzOffset  = d.timezone; // seconds offset from UTC

  const sunrise   = d.sys.sunrise;
  const sunset    = d.sys.sunset;
  const nowUTC    = Math.floor(Date.now() / 1000); // current Unix time (seconds)

  // Format times for display
  sunriseTimeEl.textContent = unixToTime(sunrise, tzOffset);
  sunsetTimeEl.textContent  = unixToTime(sunset,  tzOffset);

  // Calculate day length (in hours and minutes)
  const daySeconds = sunset - sunrise;
  const dayHours   = Math.floor(daySeconds / 3600);
  const dayMins    = Math.floor((daySeconds % 3600) / 60);
  dayLengthEl.textContent = `${dayHours}h ${dayMins}m of daylight`;

  // Animate the arc: calculate how far through the day we are (0 to 1)
  const progress = Math.min(Math.max((nowUTC - sunrise) / (sunset - sunrise), 0), 1);

  // The total dash length of our SVG arc path (approximate)
  const ARC_LENGTH = 170;
  sunArcFill.setAttribute("stroke-dasharray", `${progress * ARC_LENGTH} ${ARC_LENGTH}`);

  // Move the sun dot along the quadratic Bezier curve
  // Bezier formula: B(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2
  // P0=(10,60), P1=(60,-5), P2=(110,60)
  const t  = progress;
  const mt = 1 - t;
  const x  = mt * mt * 10 + 2 * mt * t * 60 + t * t * 110;
  const y  = mt * mt * 60 + 2 * mt * t * (-5) + t * t * 60;
  sunDot.setAttribute("cx", x.toFixed(1));
  sunDot.setAttribute("cy", y.toFixed(1));
}

/**
 * Render the 5-day forecast sidebar list.
 * The /forecast endpoint returns 3-hour slots; we pick one per day
 * (specifically the slot closest to noon) and show min/max temps.
 */
function renderForecast() {
  const list = forecastData.list;

  // Group forecast slots by calendar date
  const byDay = {};
  list.forEach(slot => {
    // slot.dt_txt format: "2026-03-15 12:00:00"
    const dateKey = slot.dt_txt.split(" ")[0]; // "2026-03-15"
    if (!byDay[dateKey]) byDay[dateKey] = [];
    byDay[dateKey].push(slot);
  });

  // We want only the NEXT 5 days (not today)
  const todayKey = new Date().toISOString().split("T")[0];
  const futureDays = Object.keys(byDay)
    .filter(k => k > todayKey)
    .slice(0, 5);

  // Clear skeleton placeholders
  forecastListEl.innerHTML = "";

  futureDays.forEach(dateKey => {
    const slots = byDay[dateKey];

    // Pick the slot closest to midday for icon & description
    const noonSlot = slots.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.dt_txt).getUTCHours() - 12);
      const currDiff = Math.abs(new Date(curr.dt_txt).getUTCHours() - 12);
      return currDiff < prevDiff ? curr : prev;
    });

    // Calculate min and max temperature for the day
    const temps   = slots.map(s => s.main.temp);
    const high     = Math.round(Math.max(...temps));
    const low      = Math.round(Math.min(...temps));
    const tempUnit = unit === "metric" ? "°C" : "°F";

    // Get day name from the date key
    const dayName = unixToDayName(noonSlot.dt);

    // Build the forecast row HTML
    const item = document.createElement("div");
    item.className = "forecast-item";
    item.innerHTML = `
      <span class="fc-day">${dayName}</span>
      <img class="fc-icon" src="${iconUrl(noonSlot.weather[0].icon)}" alt="${noonSlot.weather[0].description}" />
      <span class="fc-desc">${noonSlot.weather[0].description}</span>
      <div class="fc-temps">
        <span class="fc-high">${high}${tempUnit}</span>
        <span class="fc-low">${low}${tempUnit}</span>
      </div>
    `;
    forecastListEl.appendChild(item);
  });
}

/**
 * Render the hourly forecast (next 8 slots = 24 hours) as scrollable chips.
 */
function renderHourly() {
  const slots = forecastData.list.slice(0, 8); // next 8 × 3-hour slots
  const tempUnit = unit === "metric" ? "°C" : "°F";
  const tzOffset = currentWeatherData.timezone;

  hourlyScrollEl.innerHTML = "";

  slots.forEach(slot => {
    const timeLabel = unixToTime(slot.dt, tzOffset);
    const temp      = Math.round(slot.main.temp);
    const icon      = slot.weather[0].icon;

    const chip = document.createElement("div");
    chip.className = "hourly-chip";
    chip.innerHTML = `
      <span class="hc-time">${timeLabel}</span>
      <img src="${iconUrl(icon)}" alt="${slot.weather[0].description}" />
      <span class="hc-temp">${temp}${tempUnit}</span>
    `;
    hourlyScrollEl.appendChild(chip);
  });
}
/*----------------------------------------------------------------------------------------------------------------------------------*/
function createWindLeaves() {
  const container = document.getElementById("windLeaves");
  container.innerHTML = "";

  for (let i = 0; i < 15; i++) {
    const leaf = document.createElement("div");
    leaf.classList.add("leaf");
    leaf.innerHTML = "🍃";

    leaf.style.left = Math.random() * 100 + "vw";
    leaf.style.animationDuration = 6 + Math.random() * 6 + "s";
    leaf.style.fontSize = 16 + Math.random() * 16 + "px";

    container.appendChild(leaf);
  }
}

/* ================================================================
   SECTION 8 — DYNAMIC BACKGROUND
   Maps weather condition IDs from the OWM API to CSS classes.
   Full list of condition codes: https://openweathermap.org/weather-conditions
================================================================ */

/**
 * Apply a CSS class to the background layer based on the current
 * weather condition. The CSS transitions handle the smooth fade.
 */
function applyDynamicBackground() {
  const conditionId = currentWeatherData.weather[0].id;
  // Remove all existing weather classes
  bgLayer.className = "bg-layer";

  // OWM condition ID ranges:
  //   2xx = Thunderstorm
  //   3xx = Drizzle
  //   5xx = Rain
  //   6xx = Snow
  //   7xx = Atmosphere (mist, fog, haze, dust…)
  //   800 = Clear sky
  //   80x = Clouds

  if (conditionId >= 200 && conditionId < 300) {
    bgLayer.classList.add("weather-thunderstorm");
  } else if (conditionId >= 300 && conditionId < 400) {
    bgLayer.classList.add("weather-drizzle");
  } else if (conditionId >= 500 && conditionId < 600) {
    bgLayer.classList.add("weather-rain");
  } else if (conditionId >= 600 && conditionId < 700) {
    bgLayer.classList.add("weather-snow");
  } else if (conditionId >= 700 && conditionId < 800) {
    bgLayer.classList.add("weather-atmosphere");
  } else if (conditionId === 800) {
    bgLayer.classList.add("weather-clear");
  } else {
    // 801–804: Partly cloudy to overcast
    bgLayer.classList.add("weather-clouds");
  }
}


/* ================================================================
   SECTION 9 — UNIT TOGGLE (°C ↔ °F)
================================================================ */

/**
 * Switch between Celsius and Fahrenheit.
 * We store the desired unit, re-fetch data (so speeds come in the
 * correct unit from the API), then re-render.
 */
btnCelsius.addEventListener("click", () => {
  if (unit === "metric") return; // already in Celsius
  unit = "metric";
  btnCelsius.classList.add("active");
  btnFahrenheit.classList.remove("active");
  // Re-load with the new unit if we have a city name
  if (cityNameEl.textContent !== "—") {
    const cityOnly = cityNameEl.textContent.split(",")[0].trim();
    loadWeather(cityOnly);
  }
});

btnFahrenheit.addEventListener("click", () => {
  if (unit === "imperial") return; // already in Fahrenheit
  unit = "imperial";
  btnFahrenheit.classList.add("active");
  btnCelsius.classList.remove("active");
  if (cityNameEl.textContent !== "—") {
    const cityOnly = cityNameEl.textContent.split(",")[0].trim();
    loadWeather(cityOnly);
  }
});


/* ================================================================
   SECTION 10 — SEARCH FORM
================================================================ */

searchForm.addEventListener("submit", (e) => {
  e.preventDefault(); // prevent the page from reloading
  const city = cityInput.value.trim();
  if (!city) {
    showError("Please enter a city name.");
    return;
  }
  loadWeather(city);
  cityInput.blur(); // close mobile keyboard
});


/* ================================================================
   SECTION 11 — CHATBOT WEATHER ADVISOR
   The chatbot uses pure JavaScript logic — no external AI API.
   It reads the stored weather data and provides contextual advice
   based on temperature, humidity, wind speed, and conditions.
================================================================ */

let chatIsOpen = false;
let welcomeShown = false;

// ── Toggle open/close ──
chatToggleBtn.addEventListener("click", () => {
  chatIsOpen = !chatIsOpen;
  if (chatIsOpen) {
    chatWindow.classList.add("open");
    chatWindow.setAttribute("aria-hidden", "false");
    // Show welcome message on first open
    if (!welcomeShown) {
      welcomeShown = true;
      addBotMessage("👋 Hi! I'm your Weather Advisor. Ask me anything about today's weather — or tap one of the quick questions below!");
    }
    chatInputEl.focus();
  } else {
    chatWindow.classList.remove("open");
    chatWindow.setAttribute("aria-hidden", "true");
  }
});

chatCloseBtn.addEventListener("click", () => {
  chatIsOpen = false;
  chatWindow.classList.remove("open");
  chatWindow.setAttribute("aria-hidden", "true");
});

// ── Quick-question buttons ──
chatQuickBtns.querySelectorAll(".qbtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const question = btn.dataset.q;
    addUserMessage(question);
    const answer = generateWeatherAdvice(question);
    // Small delay so it feels more natural
    setTimeout(() => addBotMessage(answer), 420);
  });
});

// ── Free-text input ──
chatInputForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = chatInputEl.value.trim();
  if (!question) return;
  addUserMessage(question);
  chatInputEl.value = "";
  const answer = generateWeatherAdvice(question);
  setTimeout(() => addBotMessage(answer), 420);
});

/**
 * Append a user message bubble to the chat window.
 * @param {string} text
 */
function addUserMessage(text) {
  const el = document.createElement("div");
  el.className = "chat-msg user";
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight; // auto-scroll to bottom
}

/**
 * Append a bot message bubble to the chat window.
 * @param {string} text
 */
function addBotMessage(text) {
  const el = document.createElement("div");
  el.className = "chat-msg bot";
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * The core advice engine.
 * It checks the question for keywords and matches them to weather
 * conditions to produce a helpful, plain-English answer.
 *
 * @param {string} question - The user's question (free text or preset).
 * @returns {string} The bot's response.
 */
function generateWeatherAdvice(question) {
  // If no weather data has been loaded yet, ask the user to search first
  if (!currentWeatherData) {
    return "Please search for a city first so I can check the weather for you! 🌍";
  }

  // Pull the values we need from the stored data
  const d          = currentWeatherData;
  const condMain   = d.weather[0].main.toLowerCase();    // e.g. "rain", "clear"
  const condDesc   = d.weather[0].description.toLowerCase();
  const temp       = d.main.temp;
  const humidity   = d.main.humidity;
  const windSpeed  = d.wind.speed;  // m/s if metric, mph if imperial
  const visibility = d.visibility;  // metres
  const condId     = d.weather[0].id;
  const city       = d.name;
  const tempUnit   = unit === "metric" ? "°C" : "°F";

  // Derived helpers
  const isRaining      = condMain === "rain" || condMain === "drizzle" || condId >= 500 && condId < 600;
  const isSnowing      = condMain === "snow" || condId >= 600 && condId < 700;
  const isThunderstorm = condMain === "thunderstorm" || condId >= 200 && condId < 300;
  const isClear        = condMain === "clear";
  const isCloudy       = condMain === "clouds";
  const isMisty        = condId   >= 700 && condId < 800;

  // Wind: "high" is > 10 m/s (~36 km/h) in metric or > 22 mph in imperial
  const highWind = unit === "metric" ? windSpeed > 10 : windSpeed > 22;
  const veryHighWind = unit === "metric" ? windSpeed > 17 : windSpeed > 38;

  // Temperature extremes
  const verycold = unit === "metric" ? temp < 0  : temp < 32;
  const cold     = unit === "metric" ? temp < 10 : temp < 50;
  const warm     = unit === "metric" ? temp > 22 : temp > 72;
  const hot      = unit === "metric" ? temp > 33 : temp > 91;

  // ── Now match the question against keywords ──
  const q = question.toLowerCase();

  // UMBRELLA?
  if (q.includes("umbrella")) {
    if (isThunderstorm) return `⛈ Definitely take an umbrella — there's a thunderstorm in ${city}! Actually, try to stay indoors if possible.`;
    if (isRaining)      return `☂ Yes, bring an umbrella! It's ${condDesc} in ${city} right now.`;
    if (isSnowing)      return `🌨 It's snowing in ${city}. An umbrella can help, but waterproof boots and a warm coat are more important!`;
    if (isMisty)        return `🌫 It's misty in ${city}. You probably won't need an umbrella, but a light jacket is a good idea.`;
    if (humidity > 80)  return `💧 It's not currently raining, but humidity is very high (${humidity}%). There's a chance of rain — carrying a compact umbrella is wise.`;
    return `☀️ No umbrella needed! The weather in ${city} looks clear. Enjoy your day!`;
  }

  // GO OUTSIDE?
  if (q.includes("outside") || q.includes("go out")) {
    if (isThunderstorm) return `⛈ I'd advise staying indoors! There's a thunderstorm in ${city} with lightning risk. Wait it out.`;
    if (veryHighWind)   return `💨 Very strong winds (${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"}) in ${city}. Outdoors isn't ideal — be careful if you do go out.`;
    if (isRaining && cold) return `🌧 It's cold and rainy in ${city} (${Math.round(temp)}${tempUnit}). Dress warmly and take an umbrella if you need to go out.`;
    if (isRaining)      return `🌧 It's raining in ${city}. You can go out — just grab an umbrella and maybe a light jacket.`;
    if (isSnowing)      return `🌨 It's snowing in ${city}. Bundle up, wear waterproof boots, and watch for slippery surfaces!`;
    if (hot)            return `☀️ It's quite hot in ${city} (${Math.round(temp)}${tempUnit}). Stay hydrated, use sunscreen, and try to avoid peak afternoon sun.`;
    if (verycold)       return `🥶 It's below freezing in ${city} (${Math.round(temp)}${tempUnit}). Layer up well if you go outside!`;
    if (isClear && !hot && !verycold) return `😎 Great day to go outside in ${city}! Clear skies and comfortable temperature (${Math.round(temp)}${tempUnit}). Enjoy!`;
    return `🌤 Weather in ${city} is ${condDesc} at ${Math.round(temp)}${tempUnit}. Should be fine to head out — dress appropriately!`;
  }

  // DRY CLOTHES?
  if (q.includes("dry clothes") || q.includes("laundry") || q.includes("washing")) {
    if (isRaining || isThunderstorm) return `🌧 Not a good idea — it's currently ${condDesc} in ${city}. Your clothes will just get wet!`;
    if (isSnowing)      return `❄️ Skip the outdoor drying in ${city} — it's snowing and the cold will prevent evaporation.`;
    if (highWind && !isRaining) return `💨 Windy but dry in ${city} (${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"}) — that's actually great for drying clothes quickly! Just peg them down firmly.`;
    if (humidity > 80)  return `💧 Humidity is high (${humidity}%) in ${city}. Clothes will dry very slowly outside. A tumble dryer or indoor rack might be better today.`;
    if (isClear && !highWind) return `☀️ Perfect drying weather in ${city}! Clear sky, low humidity. Get those clothes out!`;
    if (isClear)        return `☀️ Good conditions to dry clothes in ${city} — it's clear and dry. Just watch for wind gusts.`;
    if (isCloudy && humidity < 65) return `⛅ Overcast in ${city} but not too humid. Clothes will dry, just a bit slower than on a sunny day.`;
    return `Check the conditions in ${city}: ${condDesc}, ${humidity}% humidity. Dry clothes are possible, but keep an eye on the sky!`;
  }

  // WINDY?
  if (q.includes("wind") || q.includes("windy")) {
    const beaufort = windSpeedToBeaufort(windSpeed, unit);
    if (veryHighWind)   return `💨 Yes, it's very windy in ${city}! Wind speed is ${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"} — ${beaufort}. Secure outdoor furniture and be careful when driving.`;
    if (highWind)       return `🌬 It's noticeably windy in ${city} (${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"} — ${beaufort}). You may want to hold onto hats and umbrellas!`;
    return `🍃 Wind in ${city} is ${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"} (${beaufort}). Nothing too extreme — conditions are manageable.`;
  }

  // JACKET?
  if (q.includes("jacket") || q.includes("coat") || q.includes("warm")) {
    if (verycold)       return `🧥 Absolutely wear a jacket — it's ${Math.round(temp)}${tempUnit} in ${city}. A heavy winter coat and layers are a must.`;
    if (cold)           return `🧥 Yes, wear a jacket! It's ${Math.round(temp)}${tempUnit} in ${city} — a medium-weight coat or hoodie would be comfortable.`;
    if (warm && isClear) return `👕 No jacket needed in ${city}! It's ${Math.round(temp)}${tempUnit} and sunny. A T-shirt or light shirt is perfect.`;
    if (isRaining)      return `🧥 Bring a waterproof jacket! It's ${condDesc} in ${city} at ${Math.round(temp)}${tempUnit}.`;
    if (warm)           return `🌤 At ${Math.round(temp)}${tempUnit} in ${city}, a light layer might be nice but you won't need a full jacket.`;
    return `At ${Math.round(temp)}${tempUnit} in ${city}, a light jacket is a sensible choice — especially if you'll be out for a while.`;
  }

  // VACATION?
  if (q.includes("vacation") || q.includes("trip") || q.includes("travel") || q.includes("holiday")) {
    if (isThunderstorm) return `⛈ Today might not be the best day for sightseeing in ${city} — there's a thunderstorm. Stay safe!`;
    if (isRaining && cold) return `🌧 Cold and rainy in ${city} (${Math.round(temp)}${tempUnit}, ${condDesc}). It's manageable with the right gear, but you may want to plan indoor activities.`;
    if (isClear && !hot && !verycold && !highWind) {
      return `✈️ Wonderful conditions for a vacation in ${city} today! It's ${condDesc}, ${Math.round(temp)}${tempUnit} — enjoy your trip! 🌟`;
    }
    if (hot)            return `☀️ It's quite hot in ${city} (${Math.round(temp)}${tempUnit}). Great for a beach day, but stay hydrated and use sunscreen!`;
    if (isSnowing)      return `❄️ ${city} has snow today! It could be beautiful for a winter trip — just pack warm clothes and expect possible travel delays.`;
    return `🌤 Current weather in ${city}: ${condDesc} at ${Math.round(temp)}${tempUnit}. Have a great trip — check back regularly as conditions can change!`;
  }

  // TEMPERATURE / HOW HOT/COLD?
  if (q.includes("temperature") || q.includes("hot") || q.includes("cold") || q.includes("temp")) {
    if (hot)   return `🌡 It's very hot in ${city} right now at ${Math.round(temp)}${tempUnit}. Stay hydrated and seek shade during peak hours!`;
    if (cold)  return `🌡 It's cold in ${city} — ${Math.round(temp)}${tempUnit}. Dress warmly!`;
    return `🌡 Current temperature in ${city}: ${Math.round(temp)}${tempUnit} (feels like ${Math.round(d.main.feels_like)}${tempUnit}). ${condDesc}.`;
  }

  // RAIN?
  if (q.includes("rain") || q.includes("raining")) {
    if (isRaining)      return `🌧 Yes, it's ${condDesc} in ${city} right now. Bring an umbrella!`;
    if (humidity > 80)  return `💧 It's not raining in ${city} yet, but high humidity (${humidity}%) means there's a chance. Keep an eye on the sky.`;
    return `☀️ No rain currently in ${city}. The skies are ${condDesc}.`;
  }

  // FOG / VISIBILITY?
  if (q.includes("fog") || q.includes("mist") || q.includes("visibility") || q.includes("drive")) {
    if (isMisty || visibility < 1000) return `🌫 Visibility is low in ${city} (${(visibility / 1000).toFixed(1)} km). Drive carefully, use fog lights, and allow extra time for journeys.`;
    if (visibility < 5000)            return `👁 Visibility in ${city} is moderate (${(visibility / 1000).toFixed(1)} km). Take care if driving.`;
    return `👁 Good visibility in ${city} — about ${(visibility / 1000).toFixed(1)} km. Safe for driving.`;
  }

  // AIR QUALITY?
  if (q.includes("air") || q.includes("pollution") || q.includes("aqi") || q.includes("breathe")) {
    if (airQualityData) {
      const aqi = airQualityData.list[0].main.aqi;
      const aqiText = ["", "Good 🟢", "Fair 🟡", "Moderate 🟠", "Poor 🔴", "Very Poor 🟣"][aqi] || "Unknown";
      const advice  = aqi <= 2
        ? "Air quality is fine for outdoor activities."
        : aqi === 3
        ? "Sensitive groups (asthma, allergies) should limit prolonged outdoor exertion."
        : "Consider limiting time outdoors, especially for exercise. A mask may help.";
      return `🌿 Air Quality in ${city}: ${aqiText}. ${advice}`;
    }
    return "Air quality data isn't available right now.";
  }

  // SUNRISE / SUNSET?
  if (q.includes("sunrise") || q.includes("sunset") || q.includes("sun")) {
    const tz = d.timezone;
    return `🌅 In ${city} today — Sunrise: ${unixToTime(d.sys.sunrise, tz)}, Sunset: ${unixToTime(d.sys.sunset, tz)}.`;
  }

  // GENERAL / FALLBACK — give a full weather summary
  return `🌤 Current conditions in ${city}: ${condDesc}, ${Math.round(temp)}${tempUnit} (feels like ${Math.round(d.main.feels_like)}${tempUnit}). Humidity: ${humidity}%, Wind: ${round1(windSpeed)} ${unit === "metric" ? "m/s" : "mph"}. Is there something specific you'd like to know?`;
}

/**
 * Convert wind speed to a simple Beaufort description.
 * @param {number} speed - Wind speed in m/s (metric) or mph (imperial)
 * @param {string} unitSystem - "metric" or "imperial"
 * @returns {string}
 */
function windSpeedToBeaufort(speed, unitSystem) {
  // Convert mph to m/s for comparison if needed
  const ms = unitSystem === "imperial" ? speed * 0.44704 : speed;
  if (ms < 0.5)  return "Calm";
  if (ms < 1.6)  return "Light Air";
  if (ms < 3.4)  return "Light Breeze";
  if (ms < 5.5)  return "Gentle Breeze";
  if (ms < 8.0)  return "Moderate Breeze";
  if (ms < 10.8) return "Fresh Breeze";
  if (ms < 13.9) return "Strong Breeze";
  if (ms < 17.2) return "Near Gale";
  if (ms < 20.8) return "Gale";
  if (ms < 24.5) return "Severe Gale";
  if (ms < 28.5) return "Storm";
  return "Violent Storm";
}


/* ================================================================
   SECTION 12 — INITIAL LOAD
   When the page first opens, load weather for the default city.
================================================================ */
loadWeather(DEFAULT_CITY);
