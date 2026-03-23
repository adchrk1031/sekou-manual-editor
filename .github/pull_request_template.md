## Summary
- What changed:
- Why:

## Scope
- Route / area affected:
  - [ ] `/`
  - [ ] `/menu`
  - [ ] `/editor`
  - [ ] `/csv`
  - [ ] `/tracking`
  - [ ] `/notice`
  - [ ] API
  - [ ] shared storage
  - [ ] deploy config

## Risk
- Main risk:
- Data compatibility risk:
- Deploy risk:

## Checks
- [ ] `npm run build`
- [ ] Existing project data still loads
- [ ] Save + reload still works
- [ ] Business dates remain `YYYY-MM-DD`
- [ ] No new `Date`-based persistence for business dates
- [ ] JSON backup contract still works
- [ ] If `/tracking` changed, approval/login flow was checked
- [ ] If PDF/layout changed, annotation/template compatibility was checked

## Notes
- Follow-up work:
- Not yet verified:
