'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:'+port+'/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function (path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {'Location' : newLocation });
    reponse.end('302 page déplacé');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if(parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('['+new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('['+new Date().toLocaleString('iso') + "] GET " +
                    url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};
var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, {'Content-Type' : page.type});
    reponse.end(page.data);
};

var indexQuery = function (query) {

    var resultat = { exists: false, id: null };

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

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function (replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};


// --- À compléter ---

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas
var getCalendar = function (sondageId) {
   var texte = "";
   for (var i = 0; i < memoire.length; i++) {
     if (memoire[i].id == sondageId) {
        var titre = memoire[i].titre;
        var date = memoire[i].date;
        var id = memoire[i].id;
     }
   }
   texte += "<!doctype html>\n<head>\n<title>"+titre+"</title>\n";
   texte += "<meta charset=\"utf-8\" />\n";
   texte += "<link rel=\"stylesheet\" type=\"text/css\" href=\"/calendar.css\"/>\n";
   texte += "<script src=\"/calendar.js\"></script>\n</head>\n<body>\n";
   texte += "<h1>"+titre+"</h1>\n";

  // TODO: Création d'un tableau

  texte += "<form id=\"soumettre\" action=\"\" method=\"GET\">\n";
  texte += "<label>\nNom:\n<input id=\"nom\" name=\"nom\" type=\"text\" required />\n";
  texte += "</label>\n\n<input id=\"disponibilites\" name=\"disponibilites\" type=\"hidden\" />\n\n";
  texte += "<button type=\"submit\" onclick=\"document.getElementById('disponibilites').value = compacterDisponibilites()\">\n";
  texte += "Participer\n</button>\n</form>\n\n";
  texte += "<p id=\"partager\">Partagez ce sondage en utilisant le lien suivant :"+hostUrl+id+"</p>\n";
  texte += "</body>\n</html>\n";

  return texte;
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function (sondageId) {
    // TODO
    return 'Resultats du sondage <b>' + sondageId + '</b> (TODO)';
};

//**Procédure qui nous permet de déterminer la validité de chaque
//**élémennt de l'id du sondage
var lettre = function(mot){
  for (var i = 0; i < mot.length; i++) {
   var position = mot.charAt(i);
   if (position >= 0 ||(position>="a" && position<="z") ||
      (position>="A" && position<="Z")) {
     continue;
   }
   else if (position == "-") {
     continue;
   }
   else {
     return false;
   }
  }
};
//**On crée notre dictionnaire
var memoire = Array(0) ;

// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.
var creerSondage = function(titre, id, dateDebut, dateFin, heureDebut, heureFin) {
    //**On met les paramètres dans le format adéquat
    // OPTIMIZE: figure what's the value of the date et hour
    titre = titre+"";
    dateDebut = +dateDebut;
    dateFin = +dateFin;
    heureDebut = +heureDebut;
    heureFin = +heureFin;
    //**On utilise la procédure lettre pour vérifier la validité de id
    lettre(id);
    //**On vérifie le bon agencement des dates et heures
    if ((heureDebut>heureFin)&&(dateDebut>dateFin)&&(dateFin-dateDebut>30)) {
      return false;
    }
    //On crée un tableau contenant les informations relatives
    memoire.push(
      {
      titre : titre,
      id : id,
      dateDebut:dateDebut,
      dateFin:dateFin,
      heureDebut:heureDebut,
      heureFin:heureFin}
    )

    return true;
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {
    // TODO
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {
    // TODO
    return '#000000';
};


/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
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
                    redirect(reponse, '/'+ id + '/results')
                    return ;
                }

                var data = getCalendar(id);

                if(data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {status: 200, data: data, type: 'text/html'};
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if(data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {status: 200, data: data, type: 'text/html'};
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
