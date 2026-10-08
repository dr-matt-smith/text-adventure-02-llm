{
  "name": "Down on the Farm",
  "description": "Bessie the cow has wandered off, the field gate is open, and the water trough is leaking. Sort it all out before the sun goes down.",
  "schemas": [
    "project:src/data/adventure.schema.json"
  ],
  "data": {
    "adventure": {
      "start": "Farmhouse",
      "title": "DOWN ON THE FARM",
      "blurb": "Bessie the cow has wandered off, the field gate\nis open, and the water trough is leaking.\nSort it all out before the sun goes down.",
      "intro": "You're a farmer, and it's been one of those days. Bessie the cow has wandered off, the gate to her field has been left wide open, and the water trough is leaking. Bring Bessie back to the FIELD, CLOSE the GATE, and find a WRENCH to FIX the TROUGH. Be quick - the sun is going down, and every step uses up some daylight.",
      "meterName": "DAYLIGHT",
      "runOutMessage": "The sun sinks below the hills. It's too dark to work - the jobs will have to wait until tomorrow...",
      "wonTitle": "ALL JOBS DONE!",
      "lostTitle": "NIGHTFALL",
      "wonMessage": "Bessie is safe in her field with fresh water,\nall sorted in {moves} moves.",
      "lostMessage": "The sun went down with jobs still to do,\nafter {moves} moves."
    }
  },
  "navigation": {
    "show": false,
    "style": "arrows",
    "position": "top-right",
    "showNumber": false
  },
  "sequenceArrows": {
    "show": false,
    "style": "dashed",
    "color": "#ffcc00",
    "alpha": 0.75
  },
  "nodes": [
    {
      "name": "Farmhouse",
      "x": 200,
      "y": 0,
      "text": "# Farmhouse\n\nYou are in the farmhouse kitchen. Your boots are by the door, and through the window you can see the farmyard.\n\nThe kitchen smells of toast. The clock on the wall ticks on.\n\nThe kettle is cold. No time for tea today.\n\n[South](Farmyard)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 0,
          "items": [
            {
              "type": "lantern"
            }
          ]
        }
      }
    },
    {
      "name": "Farmyard",
      "x": 200,
      "y": 120,
      "text": "# Farmyard\n\nYou are in the farmyard. Chickens scatter as you walk past. The barn is to the west, a muddy lane leads east, and the cow field is to the south.\n\nThe chickens eye you suspiciously.\n\n[North](Farmhouse) · [West](Barn) · [East](Lane) · [South](Field)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 1
        }
      }
    },
    {
      "name": "Barn",
      "x": 0,
      "y": 120,
      "text": "# Barn\n\nYour lantern lights up the barn. Bales of hay are stacked to the roof, and there is a workbench against the wall.\n\nDust drifts through the lantern light.\n\n[East](Farmyard)\n",
      "data": {
        "adventure": {
          "mapCol": 0,
          "mapRow": 1,
          "dark": "You step into the barn. It is pitch black in here - you can't see a thing without a light.",
          "items": [
            {
              "name": "wrench",
              "description": "A big adjustable wrench. Just the thing for a leaking pipe."
            }
          ]
        }
      }
    },
    {
      "name": "Field",
      "x": 200,
      "y": 240,
      "text": "# Field\n\nYou are in the cow field. The grass is long and green. There is a gate in the fence, and a water trough in the corner.\n\nLong grass sways in the breeze.\n\n[North](Farmyard)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 2,
          "items": [
            {
              "type": "gate"
            },
            {
              "type": "trough"
            }
          ]
        }
      }
    },
    {
      "name": "Lane",
      "x": 400,
      "y": 120,
      "text": "# Lane\n\nYou are on a muddy lane between tall hedges. There are fresh hoof prints in the mud, heading east.\n\nYour boots squelch in the mud.\n\n[West](Farmyard) · [North](Orchard) · [East](Meadow) · [South](Pond)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 1
        }
      }
    },
    {
      "name": "Orchard",
      "x": 400,
      "y": 0,
      "text": "# Orchard\n\nYou are in the orchard. Apple trees stand in neat rows, and windfalls lie in the grass.\n\nA blackbird pecks at a fallen apple.\n\n[South](Lane)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 0,
          "items": [
            {
              "name": "apple",
              "description": "A crisp red apple. It looks delicious."
            }
          ]
        }
      }
    },
    {
      "name": "Meadow",
      "x": 600,
      "y": 120,
      "text": "# Meadow\n\nYou come out into a wild meadow full of buttercups. The hoof prints end here.\n\nBees buzz among the buttercups.\n\n[West](Lane)\n",
      "data": {
        "adventure": {
          "mapCol": 3,
          "mapRow": 1,
          "items": [
            {
              "type": "cow"
            }
          ]
        }
      }
    },
    {
      "name": "Pond",
      "x": 400,
      "y": 240,
      "text": "# Pond\n\nYou reach the duck pond. The ducks quack crossly at you.\n\nThe ducks paddle away from you.\n\n[North](Lane)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 2,
          "items": [
            {
              "name": "fishing rod",
              "description": "An old fishing rod. No time for fishing today!"
            }
          ]
        }
      }
    }
  ]
}
