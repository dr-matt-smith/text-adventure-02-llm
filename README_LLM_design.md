# Free-text input with a local LLM - design

This describes how a local LLM (running in LM Studio) lets the player type in their own words. The
LLM helps with **one turn at a time**: it never plays several moves for the player.

> **Status:** built, as described here. It replaced an earlier, more ambitious version, which planned
> and ran several commands for one message, re-planning after each move, with a `GOTO <place>`
> command. That turned out too hard to follow, and too easy for the LLM to get wrong.

## The idea in one sentence

The player types anything; the LLM either **answers a question** from what the player has already
seen, or turns the text into **one** game command - and then the game waits for the player again.

## One turn, step by step

1. **The player types some text**, e.g. *"pick up the lamp"*, *"where was the cow?"*.
2. **Plain commands skip the LLM.** If the text is already a command the game understands - a known
   verb with no noun (`look`), a direction (`go north`, `n`), or an item the player can see or is
   carrying (`take cell`) - it goes straight to the game, with no delay.
3. **Anything else goes to the LLM**, which replies with exactly ONE of:
   - **a command** - a single valid game command, e.g. `take lantern` or `north`, or
   - **an answer** - a short reply to a question, from what the player has seen so far.
4. **A command** is shown (`= take lantern`) and given to the game, exactly as if the player had
   typed it. The player sees the game's own reply. If it was a move, the status panel and mini map
   update. It uses up a move and oxygen/daylight like any other command.
5. **An answer** is shown in a different colour, marked as coming from the LLM. Nothing changes in
   the game: no move is made, and no time is used.
6. **The game waits for the player's next message.** The LLM never follows one command with another.

```
player text --> plain command? --yes--> game --> game's reply (+ map update)
                     |
                     no
                     v
                    LLM --command--> game --> game's reply (+ map update)
                     |
                     +--answer--> shown to the player (game unchanged)
```

## What the LLM can do

**Turn free text into one command, for where the player is now:**

| Player types | LLM chooses |
|---|---|
| *pick up the lamp* | `take lantern` |
| *what have I got?* | `inventory` |
| *head out the door* (the only exit is south) | `south` |
| *shut it* (standing by the gate) | `close gate` |
| *have a good look at the cell* | `examine power cell` |

**Answer questions about places the player has visited:**

| Player types | LLM answers |
|---|---|
| *where was the cow?* | *You saw Bessie in the Meadow.* |
| *how do I get back to the ship?* | *From here: east, then north.* |
| *remind me what the field looked like* | the Field's description, as the player saw it |
| *what was in the barn?* | *A wrench, when you were last there.* |

## The single-move rule

Movement is **one location per message**. A command can be at most one direction (`north`,
`south`, `east` or `west`), and is never followed by another command.

- *"go back to the ship"*, two locations away, is **not** carried out. The LLM may only reply with
  directions as an answer (*"east, then north"*), or with the first step (`east`). The player then
  types again for the next step.
- *"take the lamp and go north"* becomes **one** command, the one that makes most sense first
  (`take lantern`). The player types again for the rest.

This is enforced **in code**, not just asked of the LLM in its instructions (see below), so the LLM
can't get round it.

## What the LLM is told

Each request to the LLM is complete in itself. The LLM keeps no memory between messages: everything
it knows is in the request.

- **The commands** - from each Command's own help text (`TAKE <item> - pick something up`...), so a
  new command is included without changing the LLM code.
- **Where the player is now** - the location's description, the items they can see, and its exits.
- **What they are carrying.**
- **What they remember** - one entry for each place they have visited:
  - its name and the description they were shown,
  - its exits, and where each one leads (if the player has been through it),
  - the items they saw there **when they were last there**.
- **The way back to each visited place** - a list of directions from where the player is now. This
  is worked out by the game's code (a breadth-first search over visited places), not by the LLM:
  LLMs are poor at finding their way round a map, and code is reliable at it.
- **What the player typed.**

The memory is recorded by the game after every command, for the place the player is in - so it only
ever holds what the player has actually seen, as they last saw it. A dark place seen without a light
is remembered as dark.

## The LLM's reply

The reply must match a JSON Schema, which LM Studio enforces as the LLM writes it:

```json
{ "kind": "command", "verb": "take", "noun": "lantern", "answer": "" }
{ "kind": "answer",  "verb": "",     "noun": "",        "answer": "You saw the cow in the Meadow." }
```

- `kind` comes first, so the LLM decides "act, or answer?" before anything else.
- `verb` can only be one of the game's own command words (an `enum` in the schema), so the LLM
  can't make up a command.
- There is room for **one** command only - no list - so it can't send several.

Then the code checks the reply before anything happens:

- The command must be one the game understands (`Adventure.understands`).
- A movement command must be a single direction.
- If the reply can't be read, or fails a check, the player's text goes to the game as typed, and
  the game gives its usual *"I don't know how to..."* reply.

## Where the code goes

| File | Job |
|---|---|
| `src/adventure/Translator.ts` | Builds the request, reads and checks the reply. Plain TypeScript: no Phaser, no network. |
| `src/adventure/Memory.ts` | What the player has seen in each visited place: description, exits, items last seen. |
| `src/llm/LmStudio.ts` | Sends the request to LM Studio. The URL, model and on/off switch are at the top. |
| `src/scenes/GameScene.ts` | Shows `(thinking...)`, then the command and the game's reply, or the LLM's answer. |
| `tests/Translator.test.ts` | Tests with a **fake** LLM, so `deno task test` needs no LM Studio. |

The Translator is *given* the function that talks to the LLM (dependency injection), so it can be
tested with a fake one, and the LLM can be swapped (Ollama, for example) by changing `LmStudio.ts`
alone.

**Removed from the earlier version:** the plan-and-re-plan loop, `GOTO <place>`, the 8-command
limit, the `requestComplete` field, and running several commands for one message.

## Setting it up

1. In LM Studio, load the model (currently `qwen/qwen3.6-35b-a3b`).
2. Start LM Studio's server **with CORS on** - the speech-bubble button in the console runs
   `~/.lmstudio/bin/lms server start --cors`. Without CORS, the browser won't let the game page talk
   to the server.
3. Play. If the server isn't running, the game says so, and carries on with its own commands.

CORS lets **any** website you visit use the LM Studio server, so stop it when you're not using the
game: `~/.lmstudio/bin/lms server stop`.

## Limitations - what players should know

- **One thing per message.** The LLM does one command, or gives one answer. *"Take the lamp and go
  north"* only takes the lamp - type again for the rest.
- **One step at a time.** It never moves you more than one location. Ask *"how do I get back to the
  ship?"* for directions, then type each step.
- **It only knows what you have seen.** It can't help you find a place you haven't been, or an item
  you haven't seen. It knows nothing about dark places you couldn't see into.
- **Its memory can be out of date.** It remembers items as they were when you were *last* in a place.
  If something has changed since (the cow has moved, say), it won't know.
- **It doesn't remember the conversation.** Each message is new to it, so follow-ups like *"and
  then?"* or *"what about the other one?"* won't work. Say what you mean in full.
- **It can be wrong.** A small local model sometimes chooses the wrong command, or gives a wrong
  answer - it can even make up a detail that sounds right. Every command it chooses is shown
  (`= take lantern`), and its answers are marked as coming from the LLM, so you can always tell, and
  type a real command instead. The game's own replies are always correct.
- **It takes a moment.** Usually a second or two (`(thinking...)`), and longer for the first message
  after LM Studio starts. Plain commands skip the LLM, and are instant.
- **Questions are free.** Answers use no moves and no oxygen or daylight. Commands the LLM chooses
  cost the same as typing them yourself.
- **It needs LM Studio running** on this computer, with CORS on. Without it, the game works as
  normal, with its own commands only.
