# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~1,790 words - fits in a single context window. You may not need a graph.

## Summary
- 107 nodes · 85 edges · 3 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.83)
- Token cost: 1,850 input · 980 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Page Components & React|Page Components & React]]
- [[_COMMUNITY_Atomic Design & Tailwind|Atomic Design & Tailwind]]
- [[_COMMUNITY_App Routing|App Routing]]

## God Nodes (most connected - your core abstractions)
1. `App Component` - 9 edges
2. `PageLayout Template Component` - 8 edges
3. `NavigationBar Component` - 7 edges
4. `Atomic Design Architecture (atoms/molecules/organisms/templates/pages)` - 6 edges
5. `Atomic Design Methodology` - 6 edges
6. `Input Atom Component` - 5 edges
7. `SearchBar Molecule Component` - 5 edges
8. `FormField Molecule Component` - 4 edges
9. `Tailwind CSS Utility Classes` - 4 edges
10. `FriendsPage Component` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Atomic Design Methodology` --conceptually_related_to--> `NavigationBar Component`  [INFERRED]
  react/README.md → react/src/components/organisms/NavigationBar/NavigationBar.tsx
- `Tailwind CSS Styling` --conceptually_related_to--> `NavigationBar Component`  [INFERRED]
  react/README.md → react/src/components/organisms/NavigationBar/NavigationBar.tsx
- `Atomic Design Methodology` --conceptually_related_to--> `FriendsPage Component`  [INFERRED]
  react/README.md → react/src/components/pages/FriendsPage/FriendsPage.tsx
- `Atomic Design Methodology` --conceptually_related_to--> `GroupsPage Component`  [INFERRED]
  react/README.md → react/src/components/pages/GroupsPage/GroupsPage.tsx
- `Atomic Design Methodology` --conceptually_related_to--> `HomePage Component`  [INFERRED]
  react/README.md → react/src/components/pages/HomePage/HomePage.tsx

## Communities

### Community 0 - "Page Components & React"
Cohesion: 0.23
Nodes (16): FriendsPage Component, React Library, GroupsPage Component, HomePage Component, Main CSS Stylesheet Link, React Root Mount Point (#root div), NavigationBar Component, Navigation Route: Friends (/friends) (+8 more)

### Community 1 - "Atomic Design & Tailwind"
Cohesion: 0.31
Nodes (11): Atomic Design Architecture (atoms/molecules/organisms/templates/pages), Button Atom Component, Tailwind CSS Utility Classes, FormField Molecule Component, FormField Inline Props (label, type, placeholder, value, onChange), Header Organism Component, Input Atom Component, InputProps Interface (+3 more)

### Community 2 - "App Routing"
Cohesion: 0.24
Nodes (10): App Component, FriendsPage (route: /friends), GroupsPage (route: /groups), HomePage (route: /), PageLayout Template, BrowserRouter (Router), Routes, react-router-dom Dependency (+2 more)

## Knowledge Gaps
- **11 isolated node(s):** `PageLayout Template`, `HomePage (route: /)`, `FriendsPage (route: /friends)`, `GroupsPage (route: /groups)`, `InputProps Interface` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App Component` connect `App Routing` to `Atomic Design & Tailwind`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Atomic Design Architecture (atoms/molecules/organisms/templates/pages)` connect `Atomic Design & Tailwind` to `App Routing`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `PageLayout Template Component` (e.g. with `HomePage Component` and `FriendsPage Component`) actually correct?**
  _`PageLayout Template Component` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `NavigationBar Component` (e.g. with `PageLayout Template Component` and `Atomic Design Methodology`) actually correct?**
  _`NavigationBar Component` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `Atomic Design Architecture (atoms/molecules/organisms/templates/pages)` (e.g. with `Button Atom Component` and `Input Atom Component`) actually correct?**
  _`Atomic Design Architecture (atoms/molecules/organisms/templates/pages)` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Atomic Design Methodology` (e.g. with `NavigationBar Component` and `PageLayout Template Component`) actually correct?**
  _`Atomic Design Methodology` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PageLayout Template`, `HomePage (route: /)`, `FriendsPage (route: /friends)` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._