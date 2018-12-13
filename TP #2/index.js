'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:' + port + '/';
var defaultPage = '/index.html';

var mimes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function(path) {
  return fs.readFileSync(path).toString('utf8');
};

var writeFile = function(path, texte) {
  fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function(reponse, path, query) {
  var newLocation = path + (query == null ? '' : '?' + query);
  reponse.writeHeader(302, {
    'Location': newLocation
  });
  reponse.end('302 page déplacé');
};

var getDocument = function(url) {
  var pathname = url.pathname;
  var parsedPath = pathParse(url.pathname);
  var result = {
    data: null,
    status: 200,
    type: null
  };

  if (parsedPath.ext in mimes) {
    result.type = mimes[parsedPath.ext];
  } else {
    result.type = 'text/plain';
  }

  try {
    result.data = readFile('./public' + pathname);
    console.log('[' + new Date().toLocaleString('iso') + "] GET " + url.path);
  } catch (e) {
    // File not found.
    console.log('[' + new Date().toLocaleString('iso') + "] GET " +
      url.path + ' not found');
    result.data = readFile('template/error404.html');
    result.type = 'text/html';
    result.status = 404;
  }

  return result;
};
var sendPage = function(reponse, page) {
  reponse.writeHeader(page.status, {
    'Content-Type': page.type
  });
  reponse.end(page.data);
};

var indexQuery = function(query) {

  var resultat = {
    exists: false,
    id: null
  };

  if (query !== null) {

    query = querystring.parse(query);
    if ('id' in query && 'titre' in query &&
      query.id.length > 0 && query.titre.length > 0) {

      resultat.exists = creerSondage(
        query.titre, query.id,
        query.dateDebut, query.dateFin,
        query.heureDebut, query.heureFin);
    }

    if (resultat.exists) {
      resultat.id = query.id;
    }
  }

  return resultat;
};

var calQuery = function(id, query) {
  if (query !== null) {
    query = querystring.parse(query);
    // query = { nom: ..., disponibilites: ... }
    ajouterParticipant(id, query.nom, query.disponibilites);
    return true;
  }
  return false;
};

var getIndex = function(replacements) {
  return {
    status: 200,
    data: readFile('template/index.html'),
    type: 'text/html'
  };
};


// --- À compléter ---

/*
 * Memory array; contains all surveys from the session
 *
 * Each element of the array is an object:
 * {titre, id, dateDebut, dateFin, heureDebut, heureFin, disponibilites}
 * Elements of the disponibilites array are objects:
 * {nom, disponibilites}
 */
var memoire = [];

/*
 * Replace-all on a string - uses global regular expressions
 * Meant for variables in HTML templates
 *
 * @param {String} text The text to search through
 * @param {String} find The placeholder
 * @param {String} replace The proper value to use for the placeholder
 * @return {String} The text with values for the placeholder
 */
var varReplace = function(text, find, replace) {
  return text.replace(new RegExp(find, 'g'), replace);
};

var mois = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

/*
 * Get the current survey
 *
 * @param {String} id The id of the survey to get
 * @return {undefined|Object} false if not found, the survey object if exists
 */
var getSurvey = function(id) {
  var sondage;

  for (var i = 0; i < memoire.length; i++) {
    if (memoire[i].id == id) sondage = memoire[i];
  }
};

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas
var getCalendar = function(sondageId) {

  var sondage = getSurvey(sondageId);
  if (typeof sondage == 'undefined') return false;

  var texte = readFile('template/calendar.html');

  // Replace placeholders
  texte = varReplace(texte, "{{titre}}", sondage.titre);
  texte = varReplace(texte, "{{url}}", hostUrl + sondage.id);

  // Get table
  var table = getCalendarTable(sondage);
  texte = varReplace(texte, "{{tableau}}", table);

  return texte;
};

/*
 * Create calendar table
 * For use in getCalendar()
 *
 * @param {Object} sondage The survey to present
 * @return {String} HTML table of calendar
 */
var getCalendarTable = function(sondage) {

  var debut = sondage.dateDebut,
      fin = sondage.dateFin,
      matin = sondage.heureDebut,
      soir = sondage.heureFin;

  var table = `
<table id="calendrier"
\tonmousedown="onClick(event)"
\tonmouseover="onMove(event)"
\tdata-nbjours="{{nbJours}}"
\tdata-nbheures="{{nbHeures}}">
\t<!-- En-tête -->
\t<tr>
\t\t<th></th>
`;

  // https://stackoverflow.com/questions/4345045 - Loop dates
  // Add date headers - nbDays for use in availability cells
  var nbDays = 0;
  for (var d = debut; d <= fin; d.setDate(d.getDate() + 1)) {
    table += "\t\t<th>" + d.getDate() + " " + mois[d.getMonth()] + "</th>\n";
    nbDays++;
  }

  table += "\t</tr>\n";

  // Add hour cells
  var nbHeures = soir - matin + 1;
  for (var h = 0; h < nbHeures; h++) {
    var current = h + matin;
    table += "\t<tr>\n\t\t<th>" + current + "h</th>\n";

    for (var c = 0; c < nbDays; c++) {
      table += "\t\t<td id='" + c + "-" + h + "'></td>\n"; // Index date-hour
    }
    table += "\t</tr>\n";
  }

  table += "</table>";

  // Replace placeholders for day/hour indexes
  table = table.replace("{{nbJours}}", nbDays);
  table = table.replace("{{nbHeures}}", nbHeures);

  return table;
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function(sondageId) {

  var sondage = getSurvey(sondageId);
  if (typeof sondage == 'undefined') return false;

  var texte = readFile('template/results.html');

  // Replace placeholders
  texte = varReplace(texte, "{{url}}", hostUrl + sondage.id);
  texte = varReplace(texte, "{{titre}}", sondage.titre);

  var table = resultsTable(sondage);
  texte = varReplace(texte, "{{tableau}}", table);

  var legende = getLegend(sondage.disponibilites);
  texte = varReplace(texte,"{{legend}}",legende);

  return texte;
};

// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.
var creerSondage = function(titre, id, dateDebut, dateFin,
  heureDebut, heureFin) {

  // Validité de l'id
  if (!/[a-zA-Z0-9\-]+/.test(id)) {
    return false;
  }

  //**On vérifie le bon agencement des dates et heures
  if ((heureDebut > heureFin) && (dateDebut > dateFin) &&
    (dateFin - dateDebut > 30)) {
    return false;
  }
  //On crée un tableau contenant les informations relatives
  memoire.push({
    titre: titre,
    id: id,
    dateDebut: new Date(dateDebut),
    dateFin: new Date(dateFin),
    heureDebut: heureDebut,
    heureFin: heureFin,
    disponibilites: []
  });

  return true;
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {
  for (var i = 0; i < memoire.length; i++) {
    if (memoire[i].id == sondageId) {
      memoire[i].disponibilites.push({
        nom: nom,
        disponibilites: disponibilites 
      });
    }
  }
};

/*
 * Create survey results calendar table
 *
 * @param {Array} sondage The event to use
 * @return {String} HTML table displaying the results
 */
var resultsTable = function(sondage) {
  var dispo = sondage.disponibilites;

  var table = "<table>\n\t<tr>\n\t\t<th></th>\n";

  // Add date columns
  var dIndex = 0;
  var debut = sondage.dateDebut, fin = sondage.dateFin;
  for (var d = debut; d <= fin; d.setDate(d.getDate() + 1)) {
    table += "\t\t<th>" + d.getDate() + " " + mois[d.getMonth()] + "</th>\n";
    dIndex++;
  }

  // Get counts of availabilities
  var dispoCounts = new Array(dispo[0].disponibilites.length);
  for (var i = 0; i < dispo.length; i++) {
    for (var c = 0; c < dispo[i].disponibilites.length; c++) {
      if (typeof dispoCounts[c] == "undefined") dispoCounts[c] = 0;
      if (dispo[i].disponibilites.charAt(c) == '1') dispoCounts[c]++;
    }
  }

  var min = Math.min(dispoCounts);
  var max = Math.max(dispoCounts);

  // Create rows for hours
  var hIndex = 0;
  var nbHeures = sondage.heureFin - sondage.heureDebut + 1;

  for (var h = 0; h < nbHeures; h++) {

    // Create cells for day-hour combinations
    var current = h + sondage.heureDebut;
    table += "\t<tr>\n\t\t<th>" + current + "h</th>\n";

    for (var j = 0; j < dIndex; j++) {
      var cell = "\t\t<td";
      var hDispo = "";
      var hNum = 0;

      for (var p = 0; p < dispo.length; p++) {
        var couleur = genColour(p, dispo.length);

        // Make coloured cases
        if (dispo[p].disponibilites.charAt(hIndex) == "1") {
          hDispo += "\t\t\t<span style='background-color: " +
            couleur + "; color:" + couleur + "'>.</span>\n";
          hNum++;
        }
      }
      hIndex++;

      // Add cases to cell
      if (hNum == max) cell += " class='max";
      else if (hNum == min) cell += " class='min";
      else { cell += "></td>\n"; continue; }

      // Add availabilities
      cell += "'>\n" + hDispo + "\t\t</td>\n";
    }
    table += "\t</tr>";
  }
  return table + "</table>";
};

/*
 * Create a legend for the survey's respondants
 *
 * @param {Array} dispo The survey's availabilities array
 * @return {String} The HTML to for the legend
 */
var getLegend = function(dispo) {
  var html = "<ul>\n";

  for (var i = 0; i < dispo.length; i++) {
    html += "\t<li style='background-color: " +
      genColour(i, dispo.length) + "'>" + dispo[i].nom + "</li>\n";
  }

  return html + "</ul>";
};


// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColour = function(i, nbTotal) {

  var teinte = i / nbTotal * 360;
  var h = teinte / 60, c = 0.7;
  var x = c * (1 - Math.abs(h % 2 - 1));

  var couleur = [];
  switch (Math.floor(h)) {
    case 0:
      couleur = [c, x, 0];
      break;
    case 1:
      couleur = [x, c, 0];
      break;
    case 2:
      couleur = [0, c, x];
      break;
    case 3:
      couleur = [0, x, c];
      break;
    case 4:
      couleur = [x, 0, c];
      break;
    case 5:
      couleur = [c, 0, x];
      break;
    default:
      couleur = [0, 0, 0];
  }

  // Convert to hexadecimal
  var hexCode = "#";
  for (var j = 0; j < couleur.length; j++) {
    var newBase = Math.floor(couleur[j] * 256); // (16^2)
    hexCode += newBase.toString(16);
  }

  return hexCode;
};


/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function(requete, reponse) {
  var url = urlParse(requete.url);

  // Redirect to index.html
  if (url.pathname == '/') {
    redirect(reponse, defaultPage, url.query);
    return;
  }

  var doc;

  if (url.pathname == defaultPage) {
    var res = indexQuery(url.query);

    if (res.exists) {
      redirect(reponse, res.id);
      return;
    } else {
      doc = getIndex(res.data);
    }
  } else {
    var parsedPath = pathParse(url.pathname);

    if (parsedPath.ext.length == 0) {
      var id;

      if (parsedPath.dir == '/') {
        id = parsedPath.base;

        if (calQuery(id, url.query)) {
          redirect(reponse, '/' + id + '/results')
          return;
        }

        var data = getCalendar(id);

        if (data === false) {
          redirect(reponse, '/error404.html');
          return;
        }

        doc = {
          status: 200,
          data: data,
          type: 'text/html'
        };
      } else {
        if (parsedPath.base == 'results') {
          id = parsedPath.dir.slice(1);
          var data = getResults(id);

          if (data === false) {
            redirect(reponse, '/error404.html');
            return;
          }

          doc = {
            status: 200,
            data: data,
            type: 'text/html'
          };
        } else {
          redirect(reponse, '/error404.html');
          return;
        }
      }
    } else {
      doc = getDocument(url);
    }
  }

  sendPage(reponse, doc);

}).listen(port);
