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

---
*Last updated: Jan 31, 2026*
