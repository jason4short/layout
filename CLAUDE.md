# CADC Memory Log

## Overview
Browser-based 2D CAD application built with vanilla JavaScript (ES6 modules) and HTML5 Canvas.

## Tech Stack
- Vanilla JS (ES6 modules)
- HTML5 Canvas 2D API
- No frameworks (pure HTML/CSS/JS)
- SVG import/export, JSON save format

## Directory Structure
```
src/
├── Main.js           # App bootstrap
├── core/             # Infrastructure (Stage, Renderer, FileManager, Commands, UndoManager, Inspector, SVG export/import)
├── geometry/         # Shape classes (Point, Line, Circle, Arc, Ellipse, Spline, Polygon, Dimension, Text, Paper, Frame, Board)
├── tools/            # Drawing/modification tools (Pointer, Line, Circle, Box, Trim, Fillet, Chamfer, Mirror, Rotate, Scale, etc.)
├── data/             # Data store, Intersections, SpatialGrid
└── assets/           # Cursors, tool icons
```

## Key Files
- `Stage.js` - Canvas viewport, zoom/pan, input handling
- `Renderer.js` - Shape rendering with pen styles
- `Data.js` - Central shape store, selections, spatial queries
- `ToolManager.js` - Active tool management
- `Commands.js` / `UndoManager.js` - Undo/redo system
- `GeometryFactory.js` - Shape instantiation
- `Intersections.js` - Geometry intersections for snapping

## Architecture
- Singleton patterns (Stage, Data, ToolManager)
- Custom event system
- World coordinates with viewport transforms
- Advanced snap system (endpoint, center, tangent, etc.)
- Full command pattern for undo/redo

## Recent Work (Jan 2026)
- Fillet tool refinements
- Mirror tool improvements
- Trim tool updates
- Added Gcode export for plotter output (GcodeExporter.js)
  - Native G02/G03 arc support
  - Adaptive chord tolerance for splines/ellipses
  - Optional GRBL arc settings ($11/$12) in header
- Selection toggle with Shift+marquee
- Shift+click promotes partial point selection to whole shape
- Images no longer locked on import
- Paper tool UI: label-only selection/drag (screen-space, not geometry)

## Work Log

### Jan 31, 2026
- Fixed `PaperTool.js:132` - `setTool('Pointer')` was passing a string instead of `toolManager.pointerTool`, causing "begin is not a function" error on tool switch after placing paper
- Removed `penStyle` and `colorToken` from Paper - set to null in constructor, removed from `clone()` and `copyFrom()`
- Updated Inspector.js to skip Appearance section for shapes with `penStyle === null` (Paper)
- Added DXF export: created `DXFExporter.js` (AutoCAD R2000 format), wired up in Main.js, added button to index.html
- Simplified DXF export to use world coordinates directly - no Paper required, exports entire shape database
- Added `{ alpha: false }` to canvas context in Stage.js for better compositing performance
- Fixed Shift+click to deselect already-selected shapes (was only toggling unselected shapes)
- Added canvas background color: stored in `data.backgroundColor`, editable in Inspector when nothing selected, saved/loaded with document
- Fixed Inspector to show Document panel on init and when deselecting (was showing "No selection")
- Tool palette now hugs content instead of stretching full height
- DA snap labels now use canvas background color instead of hardcoded white
- Extended ParallelLineTool to support circles and arcs (renamed to "Offset" tool) - creates concentric copies with adjusted radius
- Fixed `Circle.js:getTangentAngle` - removed incorrect special cases for cardinal points; now always delegates to CircleUtils.getTangentAngle
- Fixed `CircleUtils.js:getTangentAngle` - negated Y in atan2 to convert from canvas coords (Y-down) to standard math coords (Y-up), matching Guide.js expectations and other shapes (Line, Ellipse, Spline)
- Updated PointerTool: clicking on an already-selected shape (without dragging) now deselects it - true toggle behavior
- Added color theme system:
  - `ThemePresets` in Renderer.js (Light, Dark, Blueprint)
  - `data.theme` and `data.penStyleOverrides` for storage
  - Theme dropdown + per-style color pickers in Document panel (Inspector.js)
  - Reset button (↺) appears when a style has been overridden
  - Save/load in FileManager.js
  - Added `foreground` color to themes for DA snap labels
  - Fixed Dimension.js to use theme dimension color instead of hardcoded #111111
- Added font controls to Text tool:
  - Created `textSchema` in InspectorSchemas.js with font family dropdown, size, bold/italic checkboxes
  - Wired up in Text.js via getInspectorSchema()

### Feb 1, 2026
- Added Outline Text tool for laser cutting:
  - `FontManager.js` - loads fonts from Google Fonts CDN, supports user uploads
  - `OutlineText.js` - geometry class that renders text as vector paths using opentype.js
  - `OutlineTextTool.js` - click to place, edit in properties panel
  - Properties: text content, font family, size, bold
  - Break Apart button converts to editable Splines/Lines
  - Added opentype.js via CDN
  - Fixed Y-axis rendering: opentype uses Y-up, canvas uses Y-down
    - draw() uses `ctx.scale(scale, -scale)` transform for proper flip
    - breakApart() uses `this.y - cmd.y` to convert coordinates
  - Added 'string' field type to Inspector.js for text input
- Selected geometry now renders on top of unselected (Data.js `getShapesToRender`)
- Symbol instance improvements:
  - Added blue draggable label (only visible when selected)
  - `hitTestLabel()` and `screenLabelBounds` for screen-space hit testing
  - Labels rendered via Renderer.js loop over `data._symbolInstances`
- Frame improvements:
  - Added blue draggable label matching Paper style
  - `hitTestLabel()` and `screenLabelBounds` for screen-space hit testing
  - Removed from snap system (like Paper) - `getSnapPOIs()` returns empty, `getGeoSnap()` returns null
- Unified label drag system in PointerTool:
  - Consolidated Paper/Symbol/Frame handling into single `labelTarget`/`labelDragStart` state
  - `getLabelTargetAtScreen()` finds any shape with `hitTestLabel()` method
  - Works automatically for any geometry that implements the label interface
- Paste into Frame: Cmd+V with a Frame selected pastes shapes into that frame (converts to local coords, assigns frameId)
- Created `LabelUtils.js` for shared label rendering:
  - Constants: LABEL_HEIGHT, LABEL_PADDING, LABEL_GAP, colors
  - `hitTestLabel()` - reusable screen-space hit testing
  - `drawLabel()` - reusable label rendering with left/right alignment
  - Refactored Paper, Frame, Symbol to use LabelUtils (reduced ~70 lines of duplication)
- Active frame indicator in Renderer.js:
  - Green dashed border around active frame
  - "Active" badge in top-right corner
  - Shows when `data.activeFrameId` is set (e.g., paste into frame)
- Symbol label now shows when part of selected group:
  - Added `data.isGroupSelected(groupId)` helper method
  - Symbol.draw() checks both direct selection and group selection
- Standardized container/label interface in Geometry base class:
  - `getLabel()` - returns display label (null by default)
  - `isContainer()` - returns whether shape contains other shapes (false by default)
  - Frame: `getLabel()` returns this.label, `isContainer()` returns true
  - Paper: `getLabel()` returns dimension string, `isContainer()` returns false (documented: not a container)
  - Symbol: `getLabel()` returns source frame label, `isContainer()` returns false (documented: references, not contains)

## Future Ideas
- **Database storage** - Move from JSON files to DB backend (prerequisite for multiplayer)
- **Multiplayer** - Real-time collaboration (CRDTs, presence, sync)

---
*Last updated: Feb 1, 2026*
