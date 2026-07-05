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

// TMDB ID -> LACartoons serie (cuando la búsqueda por título falla o hay varias entregas)
var KNOWN_SERIES = {
  "9919": { href: "/serie/280", title: "Ben 10", year: 2005 },
  "14644": { href: "/serie/281", title: "Ben 10: Fuerza Alienigena", year: 2008 },
  "31746": { href: "/serie/282", title: "Ben 10: Supremacia Alienigena", year: 2010 }
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
  add(mediaInfo.title);
  add(mediaInfo.originalTitle);
  var titles = [mediaInfo.title, mediaInfo.originalTitle];
  for (var t = 0; t < titles.length; t++) {
    var words = normalizeTitle(titles[t]).split(/\s+/).filter(function(w) { return w.length >= 3; });
    if (words.length > 0) add(words[0]);
    if (words.length > 1) add(words.slice(0, 2).join(" "));
  }
  if (mediaInfo.alternativeTitles) {
    for (var i = 0; i < mediaInfo.alternativeTitles.length; i++) {
      add(mediaInfo.alternativeTitles[i]);
    }
  }
  if (/ben\s*10/i.test(mediaInfo.title || "") || /ben\s*10/i.test(mediaInfo.originalTitle || "")) {
    add("Ben 10");
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
          if (trans[j].iso_639_1 === "es" && trans[j].data) {
            if (trans[j].data.title) titles.push(trans[j].data.title);
            if (trans[j].data.name) titles.push(trans[j].data.name);
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
        if (allResults.length > 0 && findBestMatch(mediaInfo, allResults)) break;
      } catch (e) {}
    }
    return allResults;
  });
}

function scoreMatch(mediaInfo, result) {
  var normMedia = normalizeTitle(mediaInfo.title);
  var normResult = normalizeTitle(result.title);
  var score = calculateTitleSimilarity(mediaInfo.title, result.title);
  if (mediaInfo.originalTitle) {
    score = Math.max(score, calculateTitleSimilarity(mediaInfo.originalTitle, result.title));
  }
  if (mediaInfo.alternativeTitles) {
    for (var i = 0; i < mediaInfo.alternativeTitles.length; i++) {
      score = Math.max(score, calculateTitleSimilarity(mediaInfo.alternativeTitles[i], result.title));
    }
  }
  if (normMedia && normMedia === normResult) {
    score = Math.max(score, 1);
  }
  if (normResult.includes(normMedia) || normMedia.includes(normResult)) {
    score = Math.max(score, 0.8);
  }
  if (/ben\s*10/i.test(mediaInfo.title || "") && /ben\s*10/i.test(result.title || "")) {
    score = Math.max(score, 0.5);
    if (normMedia === "ben 10" && normResult.indexOf("ben 10 ") === 0) {
      score -= 0.2;
    }
  }
  var firstWord = normMedia.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3 && normResult.indexOf(firstWord) === 0) {
    score = Math.max(score, firstWord.length >= 4 ? 0.55 : 0.45);
  }
  if (mediaInfo.year && result.year === mediaInfo.year) score += 0.25;
  return score;
}

function getTMDBDetails(tmdbId, mediaType) {
  return __async(null, null, function* () {
    var endpoint = mediaType === "tv" ? "tv" : "movie";
    var url = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
    var response = yield fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": USER_AGENT }
    });
    if (!response.ok) throw new Error("TMDB API error: " + response.status);
    var data = yield response.json();
    var title = mediaType === "tv" ? data.name : data.title;
    var releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    var year = releaseDate ? parseInt(releaseDate.split("-")[0], 10) : null;
    return {
      title: title,
      year: year,
      originalTitle: data.original_title || data.original_name || title
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
    if (score > bestScore && score > 0.2) {
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

function resolveCubeEmbed(embedUrl) {
  return __async(null, null, function* () {
    try {
      var idMatch = embedUrl.match(/#([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      var videoId = idMatch[1];
      var origin = "https://cubeembed.rpmvid.com";
      var embedHeaders = {
        "User-Agent": USER_AGENT,
        Referer: BASE_URL + "/",
        Origin: origin,
        Accept: "application/json, text/plain, */*"
      };
      var folderRes = yield fetch(origin + "/api/v1/folder?id=" + encodeURIComponent(videoId), {
        headers: embedHeaders
      });
      if (!folderRes.ok) return null;
      var folder = (yield folderRes.text()).trim();
      var downloadUrl = origin + "/api/v1/download?id=" + encodeURIComponent(videoId) + "&folder=" + encodeURIComponent(folder);
      var apiRes = yield fetch(downloadUrl, { headers: embedHeaders });
      if (apiRes.ok) {
        var body = yield apiRes.text();
        if (/\.m3u8/i.test(body)) {
          var m3u8Match = body.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
          if (m3u8Match) {
            return {
              url: m3u8Match[0],
              quality: "720p",
              headers: { Referer: origin + "/", "User-Agent": USER_AGENT }
            };
          }
        }
        try {
          var json = JSON.parse(body);
          var streamUrl = json.url || json.file || json.source || json.hls || json.m3u8 || json.stream;
          if (streamUrl && /\.(m3u8|mp4)/i.test(streamUrl)) {
            return {
              url: streamUrl,
              quality: matchQuality(json.quality || json.label || ""),
              headers: { Referer: origin + "/", "User-Agent": USER_AGENT }
            };
          }
        } catch (e) {}
      }
      var pageHtml = yield fetchText(embedUrl, { Referer: BASE_URL + "/" });
      var directMatch = pageHtml.match(/https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i);
      if (directMatch) {
        return {
          url: directMatch[0],
          quality: "720p",
          headers: { Referer: origin + "/", "User-Agent": USER_AGENT }
        };
      }
    } catch (e) {
      console.log("[LACartoons] CubeEmbed resolve error: " + e.message);
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
    if (lower.includes("cubeembed.rpmvid.com") || lower.includes("rpmvid.com")) {
      return yield resolveCubeEmbed(embedUrl);
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
        embedUrl.includes("rpmvid.com") ? "RPMVid" : "Embed";
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
