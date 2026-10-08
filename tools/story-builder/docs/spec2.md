# version 2

a default sequence of nodes

## sequence tool
- add a tool to the left of "+" (so it is left most)
    - icon something like "1/2/3" or a multiple-page document icon

when selected 
- the tool icon highlights
- a list of nodes is shown in a pop-out sidebar on the left of the webview
- there is a DRAG handle on each slide
- the user can DRAG a node to changes the stories default node sequence

## Story properties

add a new property:
- Show default sequence nav buttons (checkbox)

- when selected, offer radio buttons for: "Nav UI style:"
    - arrows (default)
    - arrows & node name

- when selected, offer radio buttons for: "Nac UI location:"
    - top right (default)
    - bottom right
    - top left
    - bottom left


## When running a Story

IF Story "Show next/previous arrows" was selected
THEN
 - show  previous / next arrows at the selected location of each slide
 - (no previous for first slide)
 - (no next for last slide)

 the sequence is based on the default node sequence

## Start node annotation in diagram
Add an annotation "START" in small letters just above the top right of the node that is first in the sequence 