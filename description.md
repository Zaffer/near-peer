turn based 2 player game, the board is a hex grid of 3 hex tiles on each side (so same layout as catan).

each player has an army consiting of 5 units, each with unique skils:
- light
- armour
- ranged
- covert
- hero

these are the stats of each unit:
Light: 
2 attack
2 defence
2 movement
1 range
1 occupancy

Armour: 
1 attack
3 defence
1 movement
1 range
1 occupancy

Ranged: 
3 attack
1 defence
1 movement
2 range
1 occupancy

Covert: 
1 attack
1 defence
1 movement
1 range
2 occupancy

Hero: 
3 attack
3 defence
1 movement
1 range
1 occupancy

there are 5 terrain types, and each player get to place one of terrain type tile each, in there half of the map only:
- capital
- town
- road
- fortress
- minefield

these are the attributes of each terrian
Capital:
+1 attack
+1 defence

Town:
+1 attack

Road:
+1 movement

Fortress:
+1 defence

Minefield:
-1 movement

the aim of the game is to move a unit you control onto your opponents capital.

the game starts with the challenger making the first move

the game has two phase: the build phase and the active phase
during the build phase each player first places their terrain tiles in their half, the very centre board tile is given to the player who moves second (to help balance the game against the first player)

each player place all of their 5 terrain tiles on a their side. each side is the tiles closest to you, plus the next four, plus the first two on the right of the third row (and the inverse for the opponent), plus middle tile if you are the player being challenged (going second).

the players need to take turns placing the tiles one at a time in any order, anywhere in their zone of initial control.

once the terrain tiles are placed then the units are placed, also one at a time in any order, anywhere in the controlled zone.

once the last unit is placed the active phase begins and the first player makes the first move. The players take turns and each turn you allowed to attack with one unit and move with one unit, it can be the same unit or two different units.

An attack is when a selected unit select a targer within range, and checks its' attack stat vs the target's defence stat. If the attack stat matches or exceeds the defence, then the target become vulnurable. Once a target is vulnerable it can be defeated by you moving a unit on it's tile, at which point it is removed from the board. If a vulnerable unit is not defeated during your turn then it vulnerable status is removed and carries on as if nothing happened. So the point is to attack and then move onto an opponent's unit on the same turn in order to defeat it.

A unit that is currently positioned on a tile that is a terrain tile with attributes, get's those attributes applied the unit on that tile, while the unit is on the tile. For example: if an armour unit moves onto a minefield, then on the next turn the armour will basically never be able to move again. A light unit that start's it's turn on a minefield may move one tile off of it, as that unit starts with movement of 2, so the minefield added -1 to the movement making it only have 1 movement that turn. If a light unit starts it's turn next to a minefield, then moves one tile onto it, then the light unit forfeits it's 2nd movement as the minefield applies it's attribute at the moment the unit is on the tile.
Same with a town, a unit occupying a town tile, gets +1 to it's attack and so on. A unit that lands on a road tile, get's +1 movement so it basically gives all 1 movement units an extra movement when such a unit lands on the road tile. A light unit moving onto a road for it's first movement, can move again, but if it's 2nd movement will not be on another road, then it only had two moves in total, but if the light unit landed on a road on it's 2nd movement it get to move a third time, and if that third movement happened to be on another road, it can move a fourth time.

Unit's can not be on the same tile as an already occupied tile, except the covert unit. So basically a light unit facing an armour on the next tile, can not move onto the tile with the armour, and if it's attack is lower than the armour the light unit can not do anything to the armour by itself.

A covert unit can occupy the same tile as any other unit in the game, but limited to one other unit. So if the oppenet has an armour with it's own covert unit on that same time already, then you cannot move your covert unit onto that same tile. So basically a covert unit can pass through any other unit that does not already have a covert unit on it already.

The game is won when a player can control the capital city. [For now we can just make it control is moving onto the capital, but later we can consider needing to control for a whole turn or something]

The ranged unit can target any unit 2 tiles away, the same as how a light unit can move two tiles. It does not need to be in a straight line, just tile distance. [something we could consider changing later is the exact coverage of ranged unit]

That's the whole game.

[another dynamic to consider later is for the build phase to be blind to opposing players, so you build your area of control without seeing what your opponent is building and you just place in any cofiguration you want without needing to take turns and consider everything your opponent is doing. Kind like a fog of war dynamic]