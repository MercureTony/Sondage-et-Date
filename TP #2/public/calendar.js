'use strict';

document.addEventListener('DOMContentLoaded', function() {
    // TODO: Ajoutez ici du code qui doit s'exécuter au chargement de
    // la page
});

var cal = document.getElementById("calendrier");
var nbHeures = cal.dataset.nbheures;
var nbJours = cal.dataset.nbjours;

var selected = [];

function onClick(event) {
    /* La variable t contient l'élément HTML sur lequel le clic a été
       fait. Notez qu'il ne s'agit pas forcément d'une case <td> du
       tableau */
    var t = event.target;

    // Attribut id de l'élément sur lequel le clic a été fait
    var id = t.id;

    // 2x parent element pour avoir le <table
    if (t.parentElement.parentElement.id == 'calendrier') {

        // De-select
        if (t.innerText == "✓") {
            t.innerText = "";

            var eIndex = selected.indexOf(id);
            if (eIndex !== -1) selected.splice(eIndex, 1);
        } else {
            t.innerText = "✓";
            selected.push(id);
        }
    }
}

function onMove(event) {
    // TODO

    var t = event.target;
    var id = t.id;
}

var compacterDisponibilites = function() {
    var binaire = "";

    for (var i = 0; i < nbJours; i++) {
        for (var j = 0; j < nbHeures; j++) {
            if (selected.indexOf(i + "-" + j) == -1) {
                binaire += "0";
            } else binaire += "1";
        }
    }

    return binaire;
};
