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
 * Replace-all on a string - uses global Regex
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

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas
var getCalendar = function(sondageId) {

  // On parcoure les dictionnaires afin de trouver le id du sondage
  var titre, id, dateDebut, dateFin, heureDebut, heureFin;

  for (var i = 0; i < memoire.length; i++) {
    if (memoire[i].id == sondageId) {
      titre = memoire[i].titre;
      id = memoire[i].id + "";
      dateDebut = memoire[i].dateDebut;
      dateFin = memoire[i].dateFin;
      heureDebut = memoire[i].heureDebut;
      heureFin = memoire[i].heureFin;
    }
  }

  if (!id) return false;

  var texte = readFile('template/calendar.html');
  texte = varReplace(texte, "{{titre}}", titre);
  texte = varReplace(texte, "{{url}}", hostUrl + id);

  // Get table
  var table = getCalendarTable(dateDebut, dateFin, heureDebut, heureFin);
  texte = varReplace(texte, "{{tableau}}", table);

  return texte;
};

/*
 * Create calendar table
 * For use in getCalendar()
 *
 * @param {Date} debut Start date
 * @param {Date} fin End date
 * @param {Int} matin Starting hour
 * @param {Int} soir Ending hour
 * @return {String} HTML table of calendar
 */
var getCalendarTable = function(debut, fin, matin, soir) {

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
    table += "\t<tr>\n\t\t<th>" + h + "h</th>\n"; // Heure

    for (var c = 0; c < nbDays; c++) {
      table += "\t\t<td id='" + c + "-" + h + "'></td>\n";
    }
    table += "\t</tr>\n";
  }

  table += "</table>";

  // Mettre les bons variables comme attributs
  table = table.replace("{{nbJours}}", nbDays);
  table = table.replace("{{nbHeures}}", nbHeures);

  return table;
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function(sondageId) {
  // TODO
  return 'Resultats du sondage <b>' + sondageId + '</b> (TODO)';
};

var memoire = [];

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
    disponibilite : []
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
      var id = memoire[i].id + "";
      memoire[i].disponibilite.push(id);
      memoire[i].disponibilite.push(nom);
    }
  }
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {

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

  // Convertir en hexadecimal
  var hexCode = "#";
  for (var j = 0; j < couleur.length; j++) {
    hexCode += couleur[j].toString(16);
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
