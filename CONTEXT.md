# Player-Facing Campaign Notes

This context defines the player-safe public campaign knowledge presented by the Qualihut site.

## Language

**Player Information Access**:
A player's ability to find and use player-safe campaign knowledge. Visual exploration and story-following are supporting paths to this knowledge.
_Avoid_: content discovery, wiki navigation

**Campaign Index**:
A curated player-facing entry point that routes common player questions to player-safe campaign knowledge.
_Avoid_: site map, wiki homepage

**Folder Index**:
A player-facing page at the clean route of any folder containing player-safe Markdown at or below it. It lists immediate child folders and content items while excluding empty, asset-only, and system directories.
_Avoid_: recursive catalogue, filesystem dump, hand-curated campaign index

**Folder Context**:
A compact breadcrumb path from a content item back through each containing Folder Index to the Campaign Index. Sibling discovery belongs on Folder Indexes rather than item pages.
_Avoid_: taxonomy metadata, sibling list, global navigation

**Folder Label**:
The player-facing name displayed for a Folder Index. It may replace an implementation-facing path segment with an approved campaign term without changing the folder's public route.
_Avoid_: route name, folder slug, inferred title

**Content Type Label**:
A compact player-facing category shown beside a content item in navigation. It translates source-schema values into table-readable terms without changing the exported record's type.
_Avoid_: raw type, folder category, content tag

**Navigation Teaser**:
A short plain-text excerpt derived deterministically from the first usable prose paragraph of an exported player-safe content item. It remains brief even when the source paragraph continues.
_Avoid_: summary, generated description, GM synopsis

**Current Campaign Context**:
The player-safe view of the campaign's active thread, including the people, places, developments, and open threads currently relevant at the table.
_Avoid_: campaign state, live plot

**Open Threads and Leads**:
Player-safe unanswered questions, opportunities, and relationships the party may choose to pursue, presented as a section of Current Campaign Context.
_Avoid_: hidden clues, GM notes, plot ledger
