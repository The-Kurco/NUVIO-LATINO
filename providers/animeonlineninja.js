// AnimeOnline.Ninja Scraper for Nuvio Local Scrapers
// DooPlay theme — returns ALL language/server options (SUB, LAT, Castellano)

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

var BASE_URL = "https://ww3.animeonline.ninja";
var TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
  "Referer": BASE_URL + "/",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1"
};

// TMDB ID -> slug en animeonline.ninja (cuando la búsqueda falla)
var KNOWN_ANIME = {
  "31724": { slug: "code-geass", title: "Code Geass" },
  "1429": { slug: "naruto", title: "Naruto" },
  "31917": { slug: "naruto-shippuden", title: "Naruto Shippuden" },
  "30984": { slug: "bleach", title: "Bleach" },
  "37854": { slug: "one-piece", title: "One Piece" },
  "46298": { slug: "hunter-x-hunter", title: "Hunter x Hunter" },
  "65942": { slug: "dragon-ball-super", title: "Dragon Ball Super" },
  "12971": { slug: "dragon-ball-z", title: "Dragon Ball Z" },
  "62745": { slug: "dragon-ball", title: "Dragon Ball" },
  "60572": { slug: "attack-on-titan", title: "Attack on Titan" },
  "85937": { slug: "demon-slayer", title: "Demon Slayer" },
  "95479": { slug: "jujutsu-kaisen", title: "Jujutsu Kaisen" },
  "94605": { slug: "chainsaw-man", title: "Chainsaw Man" },
  "63926": { slug: "one-punch-man", title: "One Punch Man" },
  "74431": { slug: "mob-psycho-100", title: "Mob Psycho 100" },
  "60625": { slug: "fairy-tail", title: "Fairy Tail" },
  "46260": { slug: "fullmetal-alchemist-brotherhood", title: "Fullmetal Alchemist Brotherhood" },
  "888": { slug: "death-note", title: "Death Note" },
  "13916": { slug: "death-note", title: "Death Note" }
};

var LANG_SECTIONS = [
  { cls: "OD_SUB", code: "SUB", label: "Subtitulado (JP+ES)" },
  { cls: "OD_LAT", code: "LAT", label: "Latino" },
  { cls: "OD_ES", code: "ESP", label: "Castellano" }
];

var GENRE_NOISE = {
  jkanime: true, crunchyroll: true, monoschinos: true, otakustv: true,
  younime: true, zonamixs: true, supergoku: true, animeflv: true,
  tioanime: true, animeid: true, legionanime: true
};

function fetchText(url, extraHeaders) {
  return __async(null, null, function* () {
    var response = yield fetch(url, {
      headers: Object.assign({}, HEADERS, extraHeaders || {}),
      redirect: "follow"
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    var text = yield response.text();
    if (isCloudflarePage(text)) throw new Error("Cloudflare block");
    return text;
  });
}

function fetchJson(url, extraHeaders) {
  return __async(null, null, function* () {
    var response = yield fetch(url, {
      headers: Object.assign({}, HEADERS, extraHeaders || {}, { Accept: "application/json, */*" }),
      redirect: "follow"
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return yield response.json();
  });
}

function absoluteUrl(href) {
  if (!href) return null;
  if (href.indexOf("http") === 0) return href;
  if (href.indexOf("//") === 0) return "https:" + href;
  return BASE_URL + (href.indexOf("/") === 0 ? href : "/" + href);
}

function matchQuality(text) {
  if (!text) return "720p";
  var v = String(text).toLowerCase();
  if (v.includes("2160") || v.includes("4k")) return "4K";
  if (v.includes("1440")) return "1440p";
  if (v.includes("1080") || v.includes("fullhd")) return "1080p";
  if (v.includes("720") || v === "hd") return "720p";
  if (v.includes("480") || v === "sd") return "480p";
  if (v.includes("360") || v.includes("low") || v.includes("mobile")) return "360p";
  return "720p";
}

function titleToSlug(title) {
  if (!title) return "";
  var core = title.split(/[:：\-–|]/)[0].trim();
  return core.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSlugCandidates(mediaInfo, tmdbId, matchHref) {
  var slugs = [];
  var add = function(s) {
    s = titleToSlug(s);
    if (s.length >= 3 && slugs.indexOf(s) === -1) slugs.push(s);
  };
  var known = KNOWN_ANIME[String(tmdbId)];
  if (known && known.slug) add(known.slug);
  if (matchHref) {
    var hrefSlug = (matchHref.match(/\/(?:serie|pelicula|episodes|episodio)\/([^/]+)/i) || [])[1];
    if (hrefSlug) {
      add(hrefSlug.replace(/-cap-\d+.*$/i, "").replace(/-\d+-cap-\d+.*$/i, ""));
    }
  }
  add(mediaInfo.title);
  add(mediaInfo.englishTitle);
  add(mediaInfo.originalTitle);
  if (mediaInfo.alternativeTitles) {
    for (var i = 0; i < mediaInfo.alternativeTitles.length; i++) {
      add(mediaInfo.alternativeTitles[i]);
    }
  }
  var words = normalizeTitle(mediaInfo.title || "").split(/\s+/).filter(function(w) { return w.length >= 3; });
  if (words.length >= 2) add(words.slice(0, 2).join("-"));
  if (words.length >= 1) add(words[0]);
  return slugs;
}

function getTMDBSeasonOffset(tmdbId, season) {
  return __async(null, null, function* () {
    var seasonNum = parseInt(season, 10) || 1;
    if (seasonNum <= 1) return 0;
    var offset = 0;
    for (var s = 1; s < seasonNum; s++) {
      try {
        var url = TMDB_BASE_URL + "/tv/" + tmdbId + "/season/" + s + "?api_key=" + TMDB_API_KEY;
        var res = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (res.ok) {
          var data = yield res.json();
          offset += (data.episodes || []).length;
        }
      } catch (e) {}
    }
    return offset;
  });
}

function buildEpisodeUrlCandidates(slug, season, episode, globalEpisode) {
  var seasonNum = parseInt(season, 10) || 1;
  var episodeNum = parseInt(episode, 10) || 1;
  var paths = [
    "/episodio/" + slug + "-cap-" + episodeNum + "/",
    "/episodio/" + slug + "-cap-" + globalEpisode + "/",
    "/episodes/" + slug + "-cap-" + episodeNum + "/",
    "/episodes/" + slug + "-cap-" + globalEpisode + "/"
  ];
  if (seasonNum > 1) {
    paths.push("/episodio/" + slug + "-" + seasonNum + "-cap-" + episodeNum + "/");
    paths.push("/episodes/" + slug + "-" + seasonNum + "-cap-" + episodeNum + "/");
  }
  var seen = new Set();
  var urls = [];
  for (var i = 0; i < paths.length; i++) {
    if (!seen.has(paths[i])) {
      seen.add(paths[i]);
      urls.push(BASE_URL + paths[i]);
    }
  }
  return urls;
}

function tryResolveEpisodePage(urls) {
  return __async(null, null, function* () {
    for (var i = 0; i < urls.length; i++) {
      try {
        var html = yield fetchText(urls[i]);
        if (hasPlayerOptions(html)) {
          console.log("[AnimeOnline] Episode page found: " + urls[i]);
          return { url: urls[i], html: html };
        }
      } catch (e) {
        console.log("[AnimeOnline] Try failed " + urls[i] + ": " + e.message);
      }
    }
    return null;
  });
}

function getKnownAnimeMatch(tmdbId) {
  var known = KNOWN_ANIME[String(tmdbId)];
  if (!known) return null;
  return {
    href: "/serie/" + known.slug + "/",
    title: known.title,
    slug: known.slug,
    type: "tv"
  };
}

function isCloudflarePage(html) {
  if (!html) return true;
  return html.indexOf("Just a moment") >= 0 ||
    html.indexOf("cf-chl") >= 0 ||
    html.indexOf("challenge-platform") >= 0 ||
    html.indexOf("Enable JavaScript and cookies") >= 0;
}

function hasPlayerOptions(html) {
  return html.indexOf("playeroptionsul") >= 0 || html.indexOf("data-post=") >= 0;
}

function normalizeTitle(title) {
  if (!title) return "";
  return title.toLowerCase()
    .replace(/\b(the|a|an|el|la|los|las|un|una|de|del|no|wo|ga|ha|to|ni|wa)\b/g, "")
    .replace(/[:\-_*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\u00C0-\u024F\u3040-\u30FF\u4E00-\u9FFF]/g, "")
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
  add(mediaInfo.spanishTitle);
  add(mediaInfo.originalTitle);
  if (mediaInfo.title && mediaInfo.title.indexOf(":") >= 0) {
    add(mediaInfo.title.split(":")[0]);
  }
  if (mediaInfo.alternativeTitles) {
    for (var i = 0; i < mediaInfo.alternativeTitles.length; i++) {
      add(mediaInfo.alternativeTitles[i]);
    }
  }
  var titles = [mediaInfo.title, mediaInfo.spanishTitle, mediaInfo.originalTitle];
  for (var t = 0; t < titles.length; t++) {
    if (!titles[t]) continue;
    var words = normalizeTitle(titles[t]).split(/\s+/).filter(function(w) { return w.length >= 3; });
    if (words.length >= 2) add(words.slice(0, 2).join(" "));
    if (words.length >= 3) add(words.slice(0, 3).join(" "));
    if (words.length === 1 && words[0].length >= 4) add(words[0]);
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
          var isSpanish = tr.iso_639_1 === "es";
          var isJapanese = tr.iso_639_1 === "ja";
          if ((isSpanish || isJapanese) && tr.data) {
            if (tr.data.title) titles.push(tr.data.title);
            if (tr.data.name) titles.push(tr.data.name);
          }
        }
      }
    } catch (e) {}
    return titles;
  });
}

function getTMDBDetails(tmdbId, mediaType) {
  return __async(null, null, function* () {
    var endpoint = mediaType === "tv" ? "tv" : "movie";
    var esUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
    var enUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US";
    var jaUrl = TMDB_BASE_URL + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=ja-JP";
    var esRes = yield fetch(esUrl, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!esRes.ok) throw new Error("TMDB API error: " + esRes.status);
    var data = yield esRes.json();
    var spanishTitle = mediaType === "tv" ? data.name : data.title;
    var originalTitle = data.original_title || data.original_name || spanishTitle;
    var releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    var year = releaseDate ? parseInt(releaseDate.split("-")[0], 10) : null;
    try {
      var enRes = yield fetch(enUrl, { headers: { "User-Agent": USER_AGENT } });
      if (enRes.ok) {
        var enData = yield enRes.json();
        var enTitle = mediaType === "tv" ? enData.name : enData.title;
        if (enTitle && enTitle !== spanishTitle) data.englishTitle = enTitle;
      }
      var jaRes = yield fetch(jaUrl, { headers: { "User-Agent": USER_AGENT } });
      if (jaRes.ok) {
        var jaData = yield jaRes.json();
        var jaTitle = mediaType === "tv" ? jaData.name : jaData.title;
        if (jaTitle && jaTitle !== spanishTitle) data.japaneseTitle = jaTitle;
      }
    } catch (e) {}
    return {
      title: spanishTitle,
      spanishTitle: spanishTitle,
      englishTitle: data.englishTitle || null,
      japaneseTitle: data.japaneseTitle || null,
      year: year,
      originalTitle: originalTitle
    };
  });
}

function parseSearchResults(html) {
  if (isCloudflarePage(html)) return [];
  var results = [];
  var seen = new Set();
  var addResult = function(href, title, year) {
    if (!href || !title) return;
    href = href.split("?")[0];
    if (href.indexOf("/serie/") < 0 && href.indexOf("/pelicula/") < 0 &&
        href.indexOf("/episodes/") < 0 && href.indexOf("/episodio/") < 0) return;
    var key = href + "|" + title;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      href: href,
      title: title.trim(),
      year: year || null,
      type: href.indexOf("/pelicula/") >= 0 ? "movie" : "tv"
    });
  };

  var linkRegex = /href="(\/(?:serie|pelicula|episodes|episodio)\/[^"#?]+)"[^>]*>([^<]{2,})</gi;
  var linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    addResult(linkMatch[1], linkMatch[2].replace(/<[^>]+>/g, ""), null);
  }

  var patterns = [
    /<article[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
    /<div class="result-item">([\s\S]*?)<\/div>\s*<\/div>/gi
  ];
  for (var p = 0; p < patterns.length; p++) {
    var blockRegex = patterns[p];
    var match;
    while ((match = blockRegex.exec(html)) !== null) {
      var block = match[1];
      var hrefMatch = block.match(/href="(\/(?:serie|pelicula|episodes|episodio)\/[^"]+)"/i);
      var titleMatch = block.match(/class="(?:title|nombre)[^"]*"[^>]*>([^<]+)</i) ||
        block.match(/<h3[^>]*>\s*<a[^>]*>([^<]+)</i);
      var yearMatch = block.match(/(?:class="year"|class="meta")[^>]*>(\d{4})</i);
      if (hrefMatch && titleMatch) {
        addResult(hrefMatch[1], titleMatch[1], yearMatch ? parseInt(yearMatch[1], 10) : null);
      }
    }
  }
  return results;
}

function searchSite(mediaInfo) {
  return __async(null, null, function* () {
    var queries = buildSearchQueries(mediaInfo);
    var allResults = [];
    var seen = new Set();
    for (var i = 0; i < queries.length; i++) {
      try {
        var searchUrl = BASE_URL + "/page/1/?s=" + encodeURIComponent(queries[i]);
        console.log('[AnimeOnline] Search query: "' + queries[i] + '"');
        var searchHtml = yield fetchText(searchUrl);
        var results = parseSearchResults(searchHtml);
        for (var j = 0; j < results.length; j++) {
          var key = results[j].href + "|" + results[j].title;
          if (!seen.has(key)) {
            seen.add(key);
            allResults.push(results[j]);
          }
        }
      } catch (e) {
        console.log("[AnimeOnline] Search error for \"" + queries[i] + "\": " + e.message);
      }
    }
    return allResults;
  });
}

function scoreMatch(mediaInfo, result, mediaType) {
  var titlesToCompare = [
    mediaInfo.title, mediaInfo.spanishTitle, mediaInfo.originalTitle,
    mediaInfo.englishTitle, mediaInfo.japaneseTitle
  ];
  if (mediaInfo.alternativeTitles) {
    titlesToCompare = titlesToCompare.concat(mediaInfo.alternativeTitles);
  }
  var score = 0;
  for (var t = 0; t < titlesToCompare.length; t++) {
    if (titlesToCompare[t]) {
      score = Math.max(score, calculateTitleSimilarity(titlesToCompare[t], result.title));
    }
  }
  var normResult = normalizeTitle(result.title);
  var normMedia = normalizeTitle(mediaInfo.title);
  if (normMedia && normResult === normMedia) score = Math.max(score, 1);
  if (normMedia && (normResult.includes(normMedia) || normMedia.includes(normResult))) {
    score = Math.max(score, 0.85);
  }
  var resultWords = normResult.split(/\s+/).filter(Boolean);
  if (resultWords.length === 1 && GENRE_NOISE[resultWords[0]]) score -= 0.5;
  if (mediaInfo.year && result.year) {
    if (mediaInfo.year === result.year) score += 0.25;
    else if (Math.abs(mediaInfo.year - result.year) > 2) score -= 0.2;
  }
  var expectedType = mediaType === "movie" ? "movie" : "tv";
  if (result.type === expectedType) score += 0.1;
  else if (result.type && result.type !== expectedType) score -= 0.25;
  if (result.href.indexOf("/serie/") >= 0) score += 0.15;
  if (result.href.indexOf("/episodes/") >= 0 || result.href.indexOf("/episodio/") >= 0) score -= 0.1;
  return score;
}

function findBestMatch(mediaInfo, searchResults, mediaType) {
  if (!searchResults || searchResults.length === 0) return null;
  var bestMatch = null;
  var bestScore = 0;
  for (var i = 0; i < searchResults.length; i++) {
    var score = scoreMatch(mediaInfo, searchResults[i], mediaType);
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = searchResults[i];
    }
  }
  return bestMatch;
}

function parseSeriesEpisodes(html) {
  var episodes = [];
  var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  var liMatch;
  while ((liMatch = liRegex.exec(html)) !== null) {
    var block = liMatch[1];
    if (block.indexOf("numerando") < 0 || block.indexOf("episodiotitle") < 0) continue;
    var numMatch = block.match(/class="numerando"[^>]*>\s*(\d+)\s*-\s*(\d+)/i);
    var hrefMatch = block.match(/class="episodiotitle"[^>]*>\s*<a[^>]+href="([^"]+)"/i);
    if (!numMatch || !hrefMatch) continue;
    episodes.push({
      season: parseInt(numMatch[1], 10),
      episode: parseInt(numMatch[2], 10),
      href: hrefMatch[1]
    });
  }
  return episodes;
}

function findEpisodeUrl(episodes, season, episode) {
  var seasonNum = parseInt(season, 10) || 1;
  var episodeNum = parseInt(episode, 10) || 1;
  for (var i = 0; i < episodes.length; i++) {
    if (episodes[i].season === seasonNum && episodes[i].episode === episodeNum) {
      return absoluteUrl(episodes[i].href);
    }
  }
  var sameSeason = episodes.filter(function(ep) { return ep.season === seasonNum; });
  if (sameSeason.length >= episodeNum) {
    return absoluteUrl(sameSeason[episodeNum - 1].href);
  }
  if (episodes.length >= episodeNum) {
    return absoluteUrl(episodes[episodeNum - 1].href);
  }
  return null;
}

function parsePlayerOptions(html) {
  var options = [];
  var seen = new Set();
  var addOption = function(post, type, nume, title) {
    if (!post || !type || nume === undefined) return;
    var key = post + "|" + type + "|" + nume;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ post: post, type: type, nume: nume, title: title || "Server " + nume });
  };

  var ulMatch = html.match(/<ul[^>]+id=["']playeroptionsul["'][^>]*>([\s\S]*?)<\/ul>/i);
  var scope = ulMatch ? ulMatch[1] : html;
  var liRegex = /<li([^>]*)>([\s\S]*?)<\/li>/gi;
  var liMatch;
  while ((liMatch = liRegex.exec(scope)) !== null) {
    var attrs = liMatch[1];
    var inner = liMatch[2];
    var post = (attrs.match(/data-post=["'](\d+)["']/i) || [])[1];
    var type = (attrs.match(/data-type=["']([^"']+)["']/i) || [])[1];
    var nume = (attrs.match(/data-nume=["']([^"']+)["']/i) || [])[1];
    var titleMatch = inner.match(/class=["']title["'][^>]*>([^<]+)/i);
    addOption(post, type, nume, titleMatch ? titleMatch[1].trim() : null);
  }
  return options;
}

function extractEmbedUrlFromResponse(text) {
  if (!text) return null;
  try {
    var data = JSON.parse(text);
    if (data.embed_url) return String(data.embed_url).replace(/\\\//g, "/");
    if (data.url) return String(data.url).replace(/\\\//g, "/");
  } catch (e) {}
  var match = text.match(/"embed_url"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/);
  if (match) return match[1].replace(/\\\//g, "/");
  return null;
}

function getDooPlayerEmbedUrl(option, refererUrl) {
  return __async(null, null, function* () {
    var referer = refererUrl || BASE_URL + "/";
    var apiUrl = BASE_URL + "/wp-json/dooplayer/v1/post/" + option.post +
      "?type=" + encodeURIComponent(option.type) + "&source=" + encodeURIComponent(option.nume);
    try {
      var json = yield fetchJson(apiUrl, { Referer: referer, "X-Requested-With": "XMLHttpRequest" });
      if (json && json.embed_url) return String(json.embed_url).replace(/\\\//g, "/");
    } catch (e) {}
    try {
      var body = "action=doo_player_ajax&post=" + encodeURIComponent(option.post) +
        "&nume=" + encodeURIComponent(option.nume) + "&type=" + encodeURIComponent(option.type);
      var response = yield fetch(BASE_URL + "/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: Object.assign({}, HEADERS, {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          Referer: referer
        }),
        body: body
      });
      if (response.ok) {
        var text = yield response.text();
        return extractEmbedUrlFromResponse(text);
      }
    } catch (e) {}
    return null;
  });
}

function parseMultiserverLinks(html) {
  var links = [];
  for (var s = 0; s < LANG_SECTIONS.length; s++) {
    var section = LANG_SECTIONS[s];
    var sectionRegex = new RegExp(
      '<div class="' + section.cls + '"[^>]*>([\\s\\S]*?)(?=<div class="OD_|</div>\\s*</div>\\s*</div>)',
      "i"
    );
    var sectionMatch = html.match(sectionRegex);
    if (!sectionMatch) continue;
    var goRegex = /go_to_player\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
    var goMatch;
    while ((goMatch = goRegex.exec(sectionMatch[1])) !== null) {
      links.push({
        url: goMatch[1],
        langCode: section.code,
        langLabel: section.label
      });
    }
  }
  if (links.length === 0) {
    var fallbackRegex = /go_to_player\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
    var fbMatch;
    while ((fbMatch = fallbackRegex.exec(html)) !== null) {
      links.push({ url: fbMatch[1], langCode: "SUB", langLabel: "Subtitulado (JP+ES)" });
    }
  }
  return links;
}

function isMultiserverUrl(url) {
  if (!url) return false;
  var lower = url.toLowerCase();
  return lower.includes("saidochesto") || lower.includes("multiserver") ||
    lower.includes("animeonlineninja") && lower.includes("multi");
}

function detectHostName(url) {
  if (!url) return "Embed";
  var lower = url.toLowerCase();
  if (lower.includes("dood") || lower.includes("ds2play") || lower.includes("d000d")) return "DoodStream";
  if (lower.includes("streamtape") || lower.includes("stp.") || lower.includes("stape.")) return "StreamTape";
  if (lower.includes("streamsb") || lower.includes("embedsb") || lower.includes("sbplay")) return "StreamSB";
  if (lower.includes("fembed") || lower.includes("feurl") || lower.includes("animefever")) return "Fembed";
  if (lower.includes("filemoon") || lower.includes("moonplayer")) return "Filemoon";
  if (lower.includes("mixdrop") || lower.includes("mxdrop")) return "MixDrop";
  if (lower.includes("uqload") || lower.includes("upload")) return "Uqload";
  if (lower.includes("voe.sx") || lower.includes("jennysteady")) return "VOE";
  if (lower.includes("streamwish") || lower.includes("wishembed") || lower.includes("filelions")) return "StreamWish";
  if (lower.includes("mp4upload")) return "Mp4Upload";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "Embed";
  }
}

function inferLangFromTitle(title) {
  if (!title) return { code: "GEN", label: "General" };
  var lower = title.toLowerCase();
  if (lower.includes("lat") || lower.includes("latino")) return { code: "LAT", label: "Latino" };
  if (lower.includes("cast") || lower.includes("esp") || lower.includes("espa")) return { code: "ESP", label: "Castellano" };
  if (lower.includes("sub") || lower.includes("subtitul")) return { code: "SUB", label: "Subtitulado (JP+ES)" };
  if (lower.includes("multi")) return { code: "MULTI", label: "Multiserver" };
  return { code: "GEN", label: "General" };
}

function unpackEval(html) {
  var match = html.match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!match) return null;
  var source = match[1];
  var radix = parseInt(match[2], 10);
  var dictionary = match[4].split("|");
  var encodeRadix = function(num) {
    var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    var result = "";
    while (num > 0) {
      result = chars[num % radix] + result;
      num = Math.floor(num / radix);
    }
    return result || "0";
  };
  return source.replace(/\b\w+\b/g, function(word) {
    var index = parseInt(word, 36);
    if (index < dictionary.length && dictionary[index]) return dictionary[index];
    return encodeRadix(index);
  });
}

function resolveDood(url) {
  return __async(null, null, function* () {
    try {
      var response = yield fetch(url, { headers: { "User-Agent": USER_AGENT, Referer: BASE_URL + "/" } });
      if (!response.ok) return null;
      var html = yield response.text();
      var passMatch = html.match(/\/pass_md5\/([^'"]+)/);
      var tokenMatch = html.match(/token=([^&'"]+)/);
      if (!passMatch) return null;
      var origin = url.match(/^(https?:\/\/[^/]+)/);
      var base = origin ? origin[1] : url;
      var mediaUrl = base + passMatch[0];
      if (tokenMatch) mediaUrl += "?token=" + tokenMatch[1] + "&expiry=" + Date.now();
      return { url: mediaUrl, quality: "720p", headers: { Referer: base + "/", "User-Agent": USER_AGENT } };
    } catch (e) {}
    return null;
  });
}

function resolveStreamTape(url) {
  return __async(null, null, function* () {
    try {
      var response = yield fetch(url, { headers: { "User-Agent": USER_AGENT, Referer: BASE_URL + "/" } });
      if (!response.ok) return null;
      var html = yield response.text();
      var match = html.match(/getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*['"][^'"]*\+?\s*\(['"]([^'"]+)['"]\)/) ||
        html.match(/https?:\/\/[^"'\s]+\.tape\.ac\/[^\s"']+/i) ||
        html.match(/https?:\/\/[^"'\s]+\.cloudflare\.stream\/[^\s"']+/i);
      if (!match) return null;
      var streamUrl = match[1] || match[0];
      return { url: streamUrl, quality: "720p", headers: { Referer: url, "User-Agent": USER_AGENT } };
    } catch (e) {}
    return null;
  });
}

function resolveStreamWish(url) {
  return __async(null, null, function* () {
    try {
      var target = url.replace("hglink.to", "vibuxer.com");
      var originMatch = target.match(/^(https?:\/\/[^/]+)/);
      var origin = originMatch ? originMatch[1] : target;
      var response = yield fetch(target, {
        headers: { "User-Agent": USER_AGENT, Referer: BASE_URL + "/", Accept: "text/html" }
      });
      if (!response.ok) return null;
      var html = yield response.text();
      var fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        var streamUrl = fileMatch[1];
        if (streamUrl.startsWith("/")) streamUrl = origin + streamUrl;
        return { url: streamUrl, quality: "720p", headers: { Referer: origin + "/", "User-Agent": USER_AGENT } };
      }
      var unpacked = unpackEval(html);
      if (unpacked) {
        var hlsMatch = unpacked.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (hlsMatch) return { url: hlsMatch[0], quality: "720p", headers: { Referer: origin + "/", "User-Agent": USER_AGENT } };
      }
    } catch (e) {}
    return null;
  });
}

function resolveGenericEmbed(url) {
  return __async(null, null, function* () {
    try {
      var response = yield fetch(url, {
        headers: { "User-Agent": USER_AGENT, Referer: BASE_URL + "/" }
      });
      if (!response.ok) return null;
      var html = yield response.text();
      var patterns = [
        /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
        /sources\s*:\s*\[["']([^"']+\.(?:m3u8|mp4)[^"']*)["']\]/i,
        /"file"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/i,
        /https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i
      ];
      for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match) {
          var streamUrl = match[1] || match[0];
          return { url: streamUrl, quality: matchQuality(streamUrl), headers: { Referer: url, "User-Agent": USER_AGENT } };
        }
      }
      var unpacked = unpackEval(html);
      if (unpacked) {
        var direct = unpacked.match(/https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/i);
        if (direct) return { url: direct[0], quality: "720p", headers: { Referer: url, "User-Agent": USER_AGENT } };
      }
    } catch (e) {}
    return null;
  });
}

function resolveEmbedUrl(url) {
  return __async(null, null, function* () {
    if (!url) return null;
    var lower = url.toLowerCase();
    if (lower.includes("dood") || lower.includes("ds2play") || lower.includes("d000d")) return yield resolveDood(url);
    if (lower.includes("streamtape") || lower.includes("stp.") || lower.includes("stape.")) return yield resolveStreamTape(url);
    if (lower.includes("streamwish") || lower.includes("wishembed") || lower.includes("filelions") || lower.includes("hglink")) {
      return yield resolveStreamWish(url);
    }
    return yield resolveGenericEmbed(url);
  });
}

function buildStream(resolved, langLabel, serverName) {
  if (!resolved || !resolved.url) return null;
  return {
    name: "AnimeOnline",
    title: "AnimeOnline - " + langLabel + " - " + serverName + " (" + (resolved.quality || "720p") + ")",
    url: resolved.url,
    quality: resolved.quality || "720p",
    headers: Object.assign({
      "User-Agent": USER_AGENT,
      "Referer": BASE_URL + "/"
    }, resolved.headers || {}),
    provider: "animeonlineninja"
  };
}

function resolveEmbedToStreams(embedUrl, langInfo, serverLabel, seenUrls, streams) {
  return __async(null, null, function* () {
    if (!embedUrl) return;
    if (isMultiserverUrl(embedUrl)) {
      try {
        var multiHtml = yield fetchText(embedUrl, { Referer: BASE_URL + "/" });
        var multiLinks = parseMultiserverLinks(multiHtml);
        for (var m = 0; m < multiLinks.length; m++) {
          yield resolveEmbedToStreams(
            multiLinks[m].url,
            { code: multiLinks[m].langCode, label: multiLinks[m].langLabel },
            serverLabel,
            seenUrls,
            streams
          );
        }
      } catch (e) {
        console.log("[AnimeOnline] Multiserver error: " + e.message);
      }
      return;
    }
    var hostName = detectHostName(embedUrl);
    var resolved = yield resolveEmbedUrl(embedUrl);
    if (!resolved || !resolved.url || seenUrls.has(resolved.url)) return;
    seenUrls.add(resolved.url);
    var stream = buildStream(resolved, langInfo.label, serverLabel || hostName);
    if (stream) streams.push(stream);
  });
}

function resolveAllPlayerOptions(pageHtml, pageUrl) {
  return __async(null, null, function* () {
    var options = parsePlayerOptions(pageHtml);
    if (options.length === 0) {
      console.log("[AnimeOnline] No player options found.");
      return [];
    }
    console.log("[AnimeOnline] Found " + options.length + " player option(s).");
    var streams = [];
    var seenUrls = new Set();
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      var langInfo = inferLangFromTitle(option.title);
      if (langInfo.code === "MULTI") langInfo = { code: "ALL", label: "Multiserver" };
      try {
        var embedUrl = yield getDooPlayerEmbedUrl(option, pageUrl);
        if (!embedUrl) {
          console.log("[AnimeOnline] No embed for option: " + option.title);
          continue;
        }
        console.log("[AnimeOnline] Option \"" + option.title + "\" -> " + embedUrl.substring(0, 80));
        yield resolveEmbedToStreams(embedUrl, langInfo, option.title, seenUrls, streams);
      } catch (e) {
        console.log("[AnimeOnline] Option error (" + option.title + "): " + e.message);
      }
    }
    return streams;
  });
}

function resolveEpisodePage(mediaInfo, tmdbId, mediaType, season, episode, match) {
  return __async(null, null, function* () {
    var pageUrl = null;
    var pageHtml = null;

    if (match && (mediaType === "movie" || match.href.indexOf("/pelicula/") >= 0)) {
      pageUrl = absoluteUrl(match.href);
      pageHtml = yield fetchText(pageUrl);
      return { pageUrl: pageUrl, pageHtml: pageHtml };
    }

    if (match && match.href.indexOf("/serie/") >= 0) {
      try {
        var seriesHtml = yield fetchText(absoluteUrl(match.href));
        var episodes = parseSeriesEpisodes(seriesHtml);
        var fromList = findEpisodeUrl(episodes, season, episode);
        if (fromList) {
          pageUrl = fromList;
          pageHtml = yield fetchText(pageUrl);
          if (hasPlayerOptions(pageHtml)) {
            return { pageUrl: pageUrl, pageHtml: pageHtml };
          }
        }
      } catch (e) {
        console.log("[AnimeOnline] Series list error: " + e.message);
      }
    }

    var episodeNum = parseInt(episode, 10) || 1;
    var offset = yield getTMDBSeasonOffset(tmdbId, season);
    var globalEpisode = offset + episodeNum;
    var slugs = buildSlugCandidates(mediaInfo, tmdbId, match ? match.href : null);
    console.log("[AnimeOnline] Trying slug URLs: " + slugs.join(", "));

    var allUrls = [];
    for (var s = 0; s < slugs.length; s++) {
      var candidates = buildEpisodeUrlCandidates(slugs[s], season, episode, globalEpisode);
      allUrls = allUrls.concat(candidates);
    }
    var resolved = yield tryResolveEpisodePage(allUrls);
    if (resolved) return { pageUrl: resolved.url, pageHtml: resolved.html };

    return null;
  });
}

function extractSeriesUrlFromPage(html) {
  var match = html.match(/href="(\/serie\/[^"]+)"/i);
  return match ? absoluteUrl(match[1]) : null;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(null, null, function* () {
    console.log("[AnimeOnline] Fetching streams for TMDB ID: " + tmdbId + ", Type: " + mediaType);
    try {
      var mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      mediaInfo.alternativeTitles = yield getTMDBAlternativeTitles(tmdbId, mediaType);
      if (mediaInfo.englishTitle) mediaInfo.alternativeTitles.push(mediaInfo.englishTitle);
      if (mediaInfo.japaneseTitle) mediaInfo.alternativeTitles.push(mediaInfo.japaneseTitle);
      console.log('[AnimeOnline] Searching for: "' + mediaInfo.title + '" / "' + mediaInfo.originalTitle + '" (' + mediaInfo.year + ")");

      var match = getKnownAnimeMatch(tmdbId);
      if (match) {
        console.log("[AnimeOnline] Known mapping TMDB " + tmdbId + " -> " + match.slug);
      }

      if (!match) {
        var searchResults = yield searchSite(mediaInfo);
        match = findBestMatch(mediaInfo, searchResults, mediaType);
      }

      var page = yield resolveEpisodePage(mediaInfo, tmdbId, mediaType, season, episode, match);
      if (!page) {
        console.log("[AnimeOnline] Could not resolve episode page (search or slug failed).");
        return [];
      }

      console.log("[AnimeOnline] Page URL: " + page.pageUrl);
      var streams = yield resolveAllPlayerOptions(page.pageHtml, page.pageUrl);

      console.log("[AnimeOnline] Found " + streams.length + " stream(s) total.");
      return streams;
    } catch (error) {
      console.error("[AnimeOnline] Error: " + error.message);
      return [];
    }
  });
}

module.exports = { getStreams };
if (typeof globalThis !== "undefined") globalThis.getStreams = getStreams;
