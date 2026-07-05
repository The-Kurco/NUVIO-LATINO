// LACartoons Scraper for Nuvio Local Scrapers
// React Native compatible version

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var CryptoJS = require("crypto-js");

var BASE_URL = "https://www.lacartoons.com";
var TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": BASE_URL + "/"
};
var OK_QUALITY_ORDER = ["fullhd", "hd", "sd", "low", "lowest", "mobile"];
var VIDSTACK_KEY = "kiemtienmua911ca";
var VIDSTACK_IVS = ["1234567890oiuytr", "0123456789abcdef"];

// TMDB ID -> LACartoons serie (cuando la búsqueda por título falla o hay varias entregas)
var KNOWN_SERIES = {
  "9919": { href: "/serie/280", title: "Ben 10", year: 2005 },
  "14644": { href: "/serie/281", title: "Ben 10: Fuerza Alienigena", year: 2008 },
  "31746": { href: "/serie/282", title: "Ben 10: Supremacia Alienigena", year: 2010 },
  "1916": { href: "/serie/1", title: "2 Perros Tontos", year: 1993 },
  "3611": { href: "/serie/17", title: "La Vaca y El Pollito", year: 1997 }
};

var SKIP_SINGLE_WORDS = {
  cow: true, chicken: true, stupid: true, dogs: true, dog: true,
  star: true, blue: true, red: true, big: true, little: true,
  super: true, man: true, girl: true, boy: true, power: true,
  bebop: true, space: true, world: true, life: true, time: true
};

function getKnownSerieMatch(tmdbId) {
  var known = KNOWN_SERIES[String(tmdbId)];
  if (!known) return null;
  return {
    href: known.href,
    title: known.title,
    year: known.year || null
  };
}

function fetchText(url, extraHeaders) {
  return __async(null, null, function* () {
    var response = yield fetch(url, {
      headers: Object.assign({}, HEADERS, extraHeaders || {}),
      redirect: "follow"
    });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    return yield response.text();
  });
}

function matchQuality(text) {
  if (!text) return "720p";
  var v = String(text).toLowerCase();
  if (v.includes("fullhd") || v.includes("1080")) return "1080p";
  if (v.includes("2160") || v.includes("4k")) return "4K";
  if (v.includes("1440")) return "1440p";
  if (v.includes("720") || v === "hd") return "720p";
  if (v.includes("480") || v === "sd") return "480p";
  if (v.includes("360") || v.includes("low")) return "360p";
  if (v.includes("mobile")) return "360p";
  return "720p";
}

function normalizeTitle(title) {
  if (!title) return "";
  return title.toLowerCase()
    .replace(/\b(the|a|an|el|la|los|las|un|una|de|del)\b/g, "")
    .replace(/[:\-_*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\u00C0-\u024F]/g, "")
    .trim();
}

function calculateTitleSimilarity(title1, title2) {
  var norm1 = normalizeTitle(title1);
  var norm2 = normalizeTitle(title2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;
  var words1 = norm1.split(/\s+/).filter(Boolean);
  var words2 = norm2.split(/\s+/).filter(Boolean);
  var set2 = new Set(words2);
  var intersection = words1.filter(function(w) { return set2.has(w); });
  var union = new Set(words1.concat(words2));
  return intersection.length / union.size;
}

function buildSearchQueries(mediaInfo) {
  var queries = [];
  var add = function(q) {
    q = (q || "").trim();
    if (q.length >= 2 && queries.indexOf(q) === -1) queries.push(q);
  };
  var addWords = function(title, allowSingle) {
    if (!title) return;
    var words = normalizeTitle(title).split(/\s+/).filter(function(w) { return w.length >= 3; });
    if (words.length >= 2) {
      add(words.slice(0, 2).join(" "));
      if (words.length >= 3) add(words.slice(0, 3).join(" "));
    }
    if (allowSingle && words.length === 1 && words[0].length >= 4 && !SKIP_SINGLE_WORDS[words[0]]) {
      add(words[0]);
    }
  };

  add(mediaInfo.title);
  add(mediaInfo.spanishTitle);
  if (mediaInfo.alternativeTitles) {
    for (var i = 0; i < mediaInfo.alternativeTitles.length; i++) {
      add(mediaInfo.alternativeTitles[i]);
    }
  }
  addWords(mediaInfo.title, true);
  addWords(mediaInfo.spanishTitle, true);
  if (mediaInfo.originalTitle && mediaInfo.originalTitle !== mediaInfo.title) {
    add(mediaInfo.originalTitle);
    addWords(mediaInfo.originalTitle, false);
  }
  return queries;
}

function getTMDBAlternativeTitles(tmdbId, mediaType) {
  return __async(null, null, function* () {
    var titles = [];
    try {
      var endpoint = mediaType === "tv" ? "tv" : "movie";
      var altUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "/alternative_titles?api_key=" + TMDB_API_KEY;
      var altRes = yield fetch(altUrl, { headers: { "User-Agent": USER_AGENT } });
      if (altRes.ok) {
        var altData = yield altRes.json();
        var list = altData.results || altData.titles || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].title) titles.push(list[i].title);
          if (list[i].name) titles.push(list[i].name);
        }
      }
      var trUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "/translations?api_key=" + TMDB_API_KEY;
      var trRes = yield fetch(trUrl, { headers: { "User-Agent": USER_AGENT } });
      if (trRes.ok) {
        var trData = yield trRes.json();
        var trans = trData.translations || [];
        for (var j = 0; j < trans.length; j++) {
          var tr = trans[j];
          var isSpanish = tr.iso_639_1 === "es" || tr.iso_3166_1 === "ES" || tr.iso_3166_1 === "MX";
          if (isSpanish && tr.data) {
            if (tr.data.title) titles.push(tr.data.title);
            if (tr.data.name) titles.push(tr.data.name);
          }
        }
      }
    } catch (e) {}
    return titles;
  });
}

function searchSite(mediaInfo) {
  return __async(null, null, function* () {
    var queries = buildSearchQueries(mediaInfo);
    var allResults = [];
    var seen = new Set();
    for (var i = 0; i < queries.length; i++) {
      try {
        var searchUrl = BASE_URL + "/?Titulo=" + encodeURIComponent(queries[i]);
        console.log('[LACartoons] Search query: "' + queries[i] + '"');
        var searchHtml = yield fetchText(searchUrl);
        var results = parseSearchResults(searchHtml);
        for (var j = 0; j < results.length; j++) {
          var key = results[j].href + "|" + results[j].title;
          if (!seen.has(key)) {
            seen.add(key);
            allResults.push(results[j]);
          }
        }
      } catch (e) {}
    }
    return allResults;
  });
}

function scoreMatch(mediaInfo, result) {
  var titlesToCompare = [mediaInfo.title, mediaInfo.spanishTitle, mediaInfo.originalTitle];
  if (mediaInfo.alternativeTitles) {
    titlesToCompare = titlesToCompare.concat(mediaInfo.alternativeTitles);
  }
  var score = 0;
  for (var t = 0; t < titlesToCompare.length; t++) {
    if (titlesToCompare[t]) {
      score = Math.max(score, calculateTitleSimilarity(titlesToCompare[t], result.title));
    }
  }
  var normMedia = normalizeTitle(mediaInfo.title);
  var normSpanish = normalizeTitle(mediaInfo.spanishTitle || "");
  var normResult = normalizeTitle(result.title);
  if (normMedia && normMedia === normResult) score = Math.max(score, 1);
  if (normSpanish && normSpanish === normResult) score = Math.max(score, 1);
  if (normResult.includes(normMedia) || normMedia.includes(normResult)) {
    score = Math.max(score, 0.85);
  }
  if (normSpanish && (normResult.includes(normSpanish) || normSpanish.includes(normResult))) {
    score = Math.max(score, 0.85);
  }
  if (/ben\s*10/i.test(mediaInfo.title || "") && /ben\s*10/i.test(result.title || "")) {
    score = Math.max(score, 0.5);
    if (normMedia === "ben 10" && normResult.indexOf("ben 10 ") === 0) {
      score -= 0.2;
    }
  }
  var mediaWords = normMedia.split(/\s+/).filter(Boolean);
  var resultWords = normResult.split(/\s+/).filter(Boolean);
  var sharedWords = mediaWords.filter(function(w) { return resultWords.indexOf(w) >= 0; });
  if (sharedWords.length === 1 && mediaWords.length > 1 && resultWords.length > 1) {
    score -= 0.35;
  }
  if (mediaInfo.year && result.year) {
    if (mediaInfo.year === result.year) score += 0.3;
    else if (Math.abs(mediaInfo.year - result.year) > 2) score -= 0.25;
  }
  return score;
}

function getTMDBDetails(tmdbId, mediaType) {
  return __async(null, null, function* () {
    var endpoint = mediaType === "tv" ? "tv" : "movie";
    var esUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
    var response = yield fetch(esUrl, {
      headers: { "Accept": "application/json", "User-Agent": USER_AGENT }
    });
    if (!response.ok) throw new Error("TMDB API error: " + response.status);
    var data = yield response.json();
    var spanishTitle = mediaType === "tv" ? data.name : data.title;
    var originalTitle = data.original_title || data.original_name || spanishTitle;
    var releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    var year = releaseDate ? parseInt(releaseDate.split("-")[0], 10) : null;
    return {
      title: spanishTitle,
      spanishTitle: spanishTitle,
      year: year,
      originalTitle: originalTitle
    };
  });
}

function parseSearchResults(html) {
  var results = [];
  var linkRegex = /<a href="(\/serie\/\d+)">([\s\S]*?)<\/a>/gi;
  var match;
  while ((match = linkRegex.exec(html)) !== null) {
    var block = match[2];
    var titleMatch = block.match(/class="nombre-serie">([^<]+)</i);
    var yearMatch = block.match(/marcador-ano">(\d{4})</i);
    if (!titleMatch) continue;
    results.push({
      href: match[1],
      title: titleMatch[1].trim(),
      year: yearMatch ? parseInt(yearMatch[1], 10) : null
    });
  }
  return results;
}

function findBestMatch(mediaInfo, searchResults) {
  if (!searchResults || searchResults.length === 0) return null;
  var bestMatch = null;
  var bestScore = 0;
  for (var i = 0; i < searchResults.length; i++) {
    var result = searchResults[i];
    var score = scoreMatch(mediaInfo, result);
    if (score > bestScore && score > 0.35) {
      bestScore = score;
      bestMatch = result;
    }
  }
  return bestMatch;
}

function parseSeasonEpisodes(html) {
  var seasons = {};
  var epRegex = /href="(\/serie\/capitulo\/\d+\?t=(\d+))"[^>]*>[\s\S]*?<span>Capitulo (\d+)-<\/span>/gi;
  var epMatch;
  while ((epMatch = epRegex.exec(html)) !== null) {
    var seasonNum = parseInt(epMatch[2], 10);
    if (!seasons[seasonNum]) seasons[seasonNum] = [];
    seasons[seasonNum].push({
      href: epMatch[1],
      episode: parseInt(epMatch[3], 10)
    });
  }
  return seasons;
}

function findEpisodeUrl(seasons, season, episode) {
  var seasonNum = parseInt(season, 10) || 1;
  var episodeNum = parseInt(episode, 10) || 1;
  var seasonEpisodes = seasons[seasonNum];
  if (!seasonEpisodes) return null;
  for (var i = 0; i < seasonEpisodes.length; i++) {
    if (seasonEpisodes[i].episode === episodeNum) {
      return BASE_URL + seasonEpisodes[i].href;
    }
  }
  if (seasonEpisodes.length >= episodeNum) {
    return BASE_URL + seasonEpisodes[episodeNum - 1].href;
  }
  return null;
}

function parseIframeSrc(html) {
  var match = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return match ? match[1].trim() : null;
}

function decodeOkJsonString(value) {
  if (!value) return value;
  return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

function resolveOkRu(embedUrl) {
  return __async(null, null, function* () {
    try {
      var html = yield fetchText(embedUrl, { Referer: BASE_URL + "/" });
      var hlsMatch = html.match(/hlsManifestUrl\\":\\"([^\\"]+)/);
      if (hlsMatch) {
        return {
          url: decodeOkJsonString(hlsMatch[1]),
          quality: "720p",
          headers: { Referer: "https://ok.ru/", "User-Agent": USER_AGENT }
        };
      }
      var metadataMatch = html.match(/"metadata\\":\\"(\{[\s\S]*?\})\\"/);
      if (metadataMatch) {
        try {
          var metadataRaw = metadataMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          var metadata = JSON.parse(metadataRaw);
          if (metadata.hlsManifestUrl) {
            return {
              url: metadata.hlsManifestUrl,
              quality: "720p",
              headers: { Referer: "https://ok.ru/", "User-Agent": USER_AGENT }
            };
          }
          if (metadata.videos && metadata.videos.length) {
            var best = null;
            for (var i = 0; i < OK_QUALITY_ORDER.length; i++) {
              var wanted = OK_QUALITY_ORDER[i];
              for (var j = 0; j < metadata.videos.length; j++) {
                if (metadata.videos[j].name === wanted && metadata.videos[j].url) {
                  best = metadata.videos[j];
                  break;
                }
              }
              if (best) break;
            }
            if (!best) best = metadata.videos[metadata.videos.length - 1];
            if (best && best.url) {
              return {
                url: decodeOkJsonString(best.url),
                quality: matchQuality(best.name),
                headers: { Referer: "https://ok.ru/", "User-Agent": USER_AGENT }
              };
            }
          }
        } catch (e) {}
      }
      var videoRegex = /"name\\":\\"(mobile|lowest|low|sd|hd|fullhd)\\",\\"url\\":\\"([^\\"]+)/g;
      var videoMatch;
      var videos = [];
      while ((videoMatch = videoRegex.exec(html)) !== null) {
        videos.push({ name: videoMatch[1], url: decodeOkJsonString(videoMatch[2]) });
      }
      if (videos.length > 0) {
        var selected = videos[videos.length - 1];
        for (var k = 0; k < OK_QUALITY_ORDER.length; k++) {
          var wantedName = OK_QUALITY_ORDER[k];
          for (var q = 0; q < videos.length; q++) {
            if (videos[q].name === wantedName) {
              selected = videos[q];
              break;
            }
          }
          if (selected.name === wantedName) break;
        }
        return {
          url: selected.url,
          quality: matchQuality(selected.name),
          headers: { Referer: "https://ok.ru/", "User-Agent": USER_AGENT }
        };
      }
    } catch (e) {
      console.log("[LACartoons] OK.ru resolve error: " + e.message);
    }
    return null;
  });
}

function decryptVidStackPayload(encodedHex) {
  for (var i = 0; i < VIDSTACK_IVS.length; i++) {
    try {
      var iv = CryptoJS.enc.Utf8.parse(VIDSTACK_IVS[i]);
      var decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(encodedHex) },
        CryptoJS.enc.Utf8.parse(VIDSTACK_KEY),
        { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
      );
      var text = decrypted.toString(CryptoJS.enc.Utf8);
      if (text && (text.indexOf("source") >= 0 || text.indexOf("m3u8") >= 0)) {
        return text;
      }
    } catch (e) {}
  }
  return null;
}

function extractStreamFromVidStackText(text, origin) {
  var sourceMatch = text.match(/"source"\s*:\s*"([^"]+)"/);
  if (sourceMatch) {
    var url = sourceMatch[1].replace(/\\/g, "");
    if (url.indexOf("http") === 0) return url;
    if (url.indexOf("/") === 0) return origin + url;
  }
  try {
    var data = JSON.parse(text);
    var streamUrl = data.source || data.url || data.file || data.hls || data.m3u8;
    if (streamUrl) return String(streamUrl).replace(/\\/g, "");
  } catch (e) {}
  var directMatch = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
  return directMatch ? directMatch[0] : null;
}

function resolveVidStack(embedUrl) {
  return __async(null, null, function* () {
    try {
      var hashMatch = embedUrl.match(/#([a-zA-Z0-9]+)/);
      if (!hashMatch) return null;
      var videoId = hashMatch[1];
      var originMatch = embedUrl.match(/^(https?:\/\/[^/]+)/);
      if (!originMatch) return null;
      var origin = originMatch[1];
      var referer = origin + "/#" + videoId;
      var apiUrl = origin + "/api/v1/video?id=" + encodeURIComponent(videoId);
      console.log("[LACartoons] Vidstack API: " + apiUrl);
      var response = yield fetch(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: referer,
          Accept: "text/plain, application/json, */*"
        }
      });
      if (!response.ok) {
        console.log("[LACartoons] Vidstack HTTP " + response.status);
        return null;
      }
      var encoded = (yield response.text()).trim();
      if (!encoded || encoded.charAt(0) === "{") {
        console.log("[LACartoons] Vidstack API returned no payload");
        return null;
      }
      var decryptedText = decryptVidStackPayload(encoded);
      if (!decryptedText) {
        console.log("[LACartoons] Vidstack decrypt failed");
        return null;
      }
      var streamUrl = extractStreamFromVidStackText(decryptedText, origin);
      if (!streamUrl) {
        console.log("[LACartoons] Vidstack stream URL not found in payload");
        return null;
      }
      console.log("[LACartoons] Vidstack stream: " + streamUrl.substring(0, 80) + "...");
      return {
        url: streamUrl,
        quality: "720p",
        headers: {
          Referer: origin + "/",
          Origin: origin,
          "User-Agent": USER_AGENT
        }
      };
    } catch (e) {
      console.log("[LACartoons] Vidstack resolve error: " + e.message);
    }
    return null;
  });
}

function resolveGenericEmbed(embedUrl) {
  return __async(null, null, function* () {
    try {
      var html = yield fetchText(embedUrl, { Referer: BASE_URL + "/" });
      var patterns = [
        /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
        /sources\s*:\s*\[["']([^"']+\.(?:m3u8|mp4)[^"']*)["']\]/i,
        /https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i
      ];
      for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match) {
          var streamUrl = match[1] || match[0];
          return {
            url: streamUrl,
            quality: "720p",
            headers: { Referer: embedUrl, "User-Agent": USER_AGENT }
          };
        }
      }
    } catch (e) {}
    return null;
  });
}

function resolveEmbed(embedUrl) {
  return __async(null, null, function* () {
    if (!embedUrl) return null;
    var lower = embedUrl.toLowerCase();
    if (lower.includes("ok.ru")) return yield resolveOkRu(embedUrl);
    if (lower.includes("cubeembed.rpmvid.com") || lower.includes("rpmvid.com") ||
        lower.includes("vidstack") || lower.includes("hubstream")) {
      return yield resolveVidStack(embedUrl);
    }
    return yield resolveGenericEmbed(embedUrl);
  });
}

function buildStream(resolved, serverName) {
  if (!resolved || !resolved.url) return null;
  return {
    name: "LACartoons",
    title: "LACartoons - " + serverName + " (" + (resolved.quality || "720p") + ")",
    url: resolved.url,
    quality: resolved.quality || "720p",
    headers: Object.assign({
      "User-Agent": USER_AGENT,
      "Referer": BASE_URL + "/"
    }, resolved.headers || {}),
    provider: "lacartoons"
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(null, null, function* () {
    console.log("[LACartoons] Fetching streams for TMDB ID: " + tmdbId + ", Type: " + mediaType);
    if (mediaType !== "tv") {
      console.log("[LACartoons] Solo series/cartoons (tv).");
      return [];
    }
    try {
      var mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      mediaInfo.alternativeTitles = yield getTMDBAlternativeTitles(tmdbId, mediaType);
      console.log('[LACartoons] Searching for: "' + mediaInfo.title + '" (' + mediaInfo.year + ")");

      var match = getKnownSerieMatch(tmdbId);
      if (match) {
        console.log("[LACartoons] Known mapping TMDB " + tmdbId + " -> " + match.href);
      } else {
        var searchResults = yield searchSite(mediaInfo);
        match = findBestMatch(mediaInfo, searchResults);
      }

      if (!match) {
        console.log("[LACartoons] No match found.");
        return [];
      }

      console.log('[LACartoons] Match found: "' + match.title + '" -> ' + match.href);
      var seriesUrl = BASE_URL + match.href;
      var seriesHtml = yield fetchText(seriesUrl);
      var seasons = parseSeasonEpisodes(seriesHtml);
      var episodeUrl = findEpisodeUrl(seasons, season, episode);

      if (!episodeUrl) {
        console.log("[LACartoons] Episode S" + season + "E" + episode + " not found.");
        return [];
      }

      console.log("[LACartoons] Episode URL: " + episodeUrl);
      var episodeHtml = yield fetchText(episodeUrl);
      var embedUrl = parseIframeSrc(episodeHtml);

      if (!embedUrl) {
        console.log("[LACartoons] No iframe player found.");
        return [];
      }

      console.log("[LACartoons] Player embed: " + embedUrl);
      var serverName = embedUrl.includes("ok.ru") ? "OK.ru" :
        (embedUrl.includes("rpmvid.com") || embedUrl.includes("vidstack") || embedUrl.includes("hubstream")) ? "Vidstack" : "Embed";
      var resolved = yield resolveEmbed(embedUrl);
      var stream = buildStream(resolved, serverName);

      if (!stream) {
        console.log("[LACartoons] Could not resolve direct stream.");
        return [];
      }

      console.log("[LACartoons] Successfully found stream.");
      return [stream];
    } catch (error) {
      console.error("[LACartoons] Error: " + error.message);
      return [];
    }
  });
}

module.exports = { getStreams };
if (typeof globalThis !== "undefined") globalThis.getStreams = getStreams;
