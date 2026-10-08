{
  "name": "Stranded",
  "description": "Your ship has crash-landed on a strange planet. Find a power cell and a tool to fit it, and get back to your ship to REPAIR it - before your oxygen runs out.",
  "schemas": [
    "project:src/data/adventure.schema.json"
  ],
  "data": {
    "adventure": {
      "start": "Ship",
      "title": "STRANDED",
      "blurb": "Your ship has crash-landed on a strange planet.\nFind what you need to repair it, and get away -\nbefore your oxygen runs out.",
      "intro": "Your ship has crash-landed on a strange planet. To take off again you need a new POWER CELL, and a tool to fit it with. Your suit's oxygen won't last for ever - every step uses some up.",
      "meterName": "OXYGEN",
      "runOutMessage": "Your oxygen runs out. Everything goes dark...",
      "wonTitle": "YOU ESCAPED!",
      "lostTitle": "OUT OF OXYGEN",
      "wonMessage": "You repaired your ship and got away\nin {moves} moves.",
      "lostMessage": "You were stranded for good\nafter {moves} moves."
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
      "name": "Ship",
      "x": 200,
      "y": 40,
      "text": "# Ship\n\nThis is your ship. It looks badly damaged: the engine panel hangs open, and the slot for the POWER CELL is empty.\n\nIf only you could fix this ship…\n\nwhen it’s dark you’ll need a light source to see what you can pick up ...\n\nThere is no way you are getting off this planet right now.\n\n[South](Outside)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 0
        }
      }
    },
    {
      "name": "Outside",
      "x": 200,
      "y": 120,
      "text": "# Outside the ship\n\nYou are outside your ship. The land around you is barren. Maybe you should explore.\n\nYour ship's scorched hull is behind you. Dust blows across the empty plain.\n\n[North](Ship) · [West](Forest) · [East](Town) · [South](Cave)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 1
        }
      }
    },
    {
      "name": "Cave",
      "x": 200,
      "y": 240,
      "text": "# Cave\n\nYour lantern lights up the cave. Crystals glitter in the walls, and the wreck of an old probe lies in the corner.\n\nThe lantern throws long shadows over the old probe.\n\n[North](Outside)\n",
      "data": {
        "adventure": {
          "mapCol": 1,
          "mapRow": 2,
          "dark": "You come across a dark cave. It is pitch black - you can't see anything without a light.",
          "items": [
            {
              "name": "power cell",
              "description": "A glowing power cell from the old probe. Still charged - and it would fit your ship!"
            }
          ]
        }
      }
    },
    {
      "name": "Forest",
      "x": 80,
      "y": 120,
      "text": "# Forest\n\nYou arrive at a seemingly endless forest. It doesn't seem safe to go any further unprepared.\n\nThe trees creak in the wind. Something moves in the shadows.\n\n[East](Outside)\n",
      "data": {
        "adventure": {
          "mapCol": 0,
          "mapRow": 1,
          "items": [
            {
              "type": "oxygen tank"
            }
          ]
        }
      }
    },
    {
      "name": "Town",
      "x": 340,
      "y": 120,
      "text": "# Town\n\nYou reach a small, but busy town.\n\nTraders shout over each other in the busy street.\n\n[West](Outside) · [North](Market) · [East](Tavern) · [South](Scrapyard)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 1
        }
      }
    },
    {
      "name": "Market",
      "x": 340,
      "y": 20,
      "text": "# Market\n\nYou arrive at a small town market. You see four market stalls.\n\nThe stallholders ignore you - you have no money.\n\n[South](Town)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 0,
          "items": [
            {
              "name": "star chart",
              "description": "A chart of the nearby stars. Pretty, but it won't fix a ship."
            }
          ]
        }
      }
    },
    {
      "name": "Tavern",
      "x": 460,
      "y": 120,
      "text": "# Tavern\n\nYou step inside the tavern. A barmaid polishes glasses behind the counter.\n\nThe tavern is warm and noisy.\n\n[West](Town)\n",
      "data": {
        "adventure": {
          "mapCol": 3,
          "mapRow": 1,
          "items": [
            {
              "type": "lantern"
            }
          ]
        }
      }
    },
    {
      "name": "Scrapyard",
      "x": 340,
      "y": 240,
      "text": "# Scrapyard\n\nYou walk into the scrapyard. Piles of rusting metal are everywhere, and there is a small shack.\n\nRusty metal creaks in the wind.\n\n[North](Town)\n",
      "data": {
        "adventure": {
          "mapCol": 2,
          "mapRow": 2,
          "items": [
            {
              "name": "wrench",
              "description": "A heavy wrench. Just the right size for your ship's engine panel."
            }
          ]
        }
      }
    }
  ]
}
