# MaterialPanel Feedback

## Overview
This feedback is based on the current state of `src/components/panels/MaterialPanel.tsx` as of the latest update.

## Findings

1. **Auto-layout math is simple but may not handle pallet boundaries robustly**
   - `colsAlongX` and `rows` are computed using `Math.floor(palletL / skidL)` and `Math.floor(palletW / skidW)`.
   - This works for even packing, but if the skid width or length does not fit cleanly, the layout may be sparse or misaligned.
   - The current gap calculation distributes remaining space evenly, which is fine, but should be validated with odd pallet/skid dimensions.

2. **Cargo lift code can be overly broad**
   - After auto-layout, the code updates every placed cargo item to the same `maxSupportHeight + cargo.dimensions.height / 2`.
   - This may unintentionally lift cargo that should remain at a different support height or that is already correctly stacked.
   - A more precise approach would only adjust cargo items that are actually above the new skid/lumber placements or that directly depend on that support layer.

3. **Material height search uses `materialTypes.find(...)` repeatedly**
   - `existingSupportHeights` maps placed materials to their type objects by searching `materialTypes` each time.
   - This is functional, but it is repeated work and could be simplified by storing type references or using a memoized lookup.

4. **Auto-layout button is only available for `skid`/`lumber` categories**
   - This is appropriate, but the UI could clarify that auto-layout only works when a pallet is active.
   - The `Auto Layout` section already checks `pallet`, which is good.

5. **`handlePlace` defaults placement at the origin**
   - A direct place action uses `{ x: 0, y: height/2, z: 0 }`.
   - This is acceptable for initial placement, but when many materials exist, the user may expect a better placement heuristic or spawn offset.

## Recommendations

- Add a sanity check so the auto-layout path and row count do not create overlapping or out-of-bounds placements.
- Limit cargo repositioning to cargo items that are actually above or near the newly placed support materials.
- Consider caching a `materialTypeById` lookup in the store or component to reduce repeated `find()` overhead.
- Add a small notice for users that auto-layout will reposition placed cargo items after skids/lumber are added.
- If bulk skid placement is the main use-case, add a dedicated preview or validation step before applying the full layout.

## Suggested MD action items

- [ ] Validate auto-layout on different pallet sizes and skid dimensions
- [ ] Check whether cargo move should be conditional rather than blanket update
- [ ] Add user feedback in the panel for `Auto Layout` effects
- [ ] Consider using a temporary placement preview before final placement

## Notes

- The current implementation is readable and the UI logic is clear.
- The main improvement opportunity is in the cargo reposition logic after auto-layout, to avoid unintended height shifts.
