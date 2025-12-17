# Claude Code - Film Club Project

## Development Approach: Test-Driven Development (TDD)

### TDD Principles

We follow strict Test-Driven Development for this project:

1. **Red-Green-Refactor Cycle**
   - Write a failing test first (Red)
   - Write minimal code to make it pass (Green)
   - Refactor while keeping tests green (Refactor)

2. **Test First, Always**
   - Never write production code without a failing test
   - Tests define the API and behavior before implementation
   - Tests serve as living documentation

3. **Small Steps**
   - Write one test at a time
   - Implement the simplest solution that passes
   - Incrementally build complexity

### Testing Strategy

#### Backend (Cloud Functions)

**Test Framework**: Jest
- Unit tests for utilities (auth, db helpers)
- Integration tests for API endpoints
- Algorithm tests for voting logic
- Mock Firebase Admin SDK for isolated testing

**Test Structure**:
```
functions/
├── src/
│   ├── utils/
│   │   ├── db.ts
│   │   ├── db.test.ts          ← Unit tests
│   │   ├── auth.ts
│   │   └── auth.test.ts        ← Unit tests
│   ├── api/
│   │   ├── auth.ts
│   │   ├── auth.test.ts        ← Integration tests
│   │   ├── films.ts
│   │   └── films.test.ts       ← Integration tests
│   └── voting/
│       ├── condorcet.ts
│       └── condorcet.test.ts   ← Algorithm tests
```

**Running Tests**:
```bash
cd functions
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm test auth.test.ts      # Run specific test file
```

#### Frontend (SvelteKit)

**Test Framework**: Vitest + Svelte Testing Library
- Component tests for UI elements
- Integration tests for user flows
- API client tests with mock responses

**Running Tests**:
```bash
npm test                    # Run all tests
npm test -- --ui           # Visual test UI
npm run test:coverage      # Coverage report
```

### TDD Workflow for This Project

#### For Each Feature:

1. **Write Test File First**
   ```bash
   touch functions/src/utils/auth.test.ts
   ```

2. **Write First Test**
   ```typescript
   describe('hashPassword', () => {
     it('should hash a password', async () => {
       const password = 'test123';
       const hash = await hashPassword(password);
       expect(hash).toBeDefined();
       expect(hash).not.toBe(password);
     });
   });
   ```

3. **Run Test (Should Fail)**
   ```bash
   npm test auth.test.ts
   ```

4. **Implement Minimal Code**
   ```typescript
   export async function hashPassword(password: string): Promise<string> {
     return bcrypt.hash(password, 10);
   }
   ```

5. **Run Test (Should Pass)**
   ```bash
   npm test auth.test.ts
   ```

6. **Refactor if Needed**
   - Extract constants
   - Improve naming
   - Keep tests passing

7. **Repeat for Next Test**

### Testing Best Practices

#### DO:
- Write descriptive test names: `it('should reject invalid password')`
- Test edge cases: empty strings, null, undefined, large values
- Use arrange-act-assert pattern
- Mock external dependencies (Firebase, network calls)
- Keep tests independent and isolated
- Test behavior, not implementation

#### DON'T:
- Skip writing tests to "move faster"
- Test private implementation details
- Write tests after the code
- Share state between tests
- Make tests dependent on execution order

### Code Coverage Goals

- **Utilities**: 100% coverage (pure functions, easy to test)
- **API Endpoints**: 90%+ coverage (test happy path + errors)
- **Voting Algorithm**: 100% coverage (critical business logic)
- **Frontend Components**: 80%+ coverage (UI + user interactions)

### Firebase Testing Setup

For Firebase Functions, we use:
- `firebase-functions-test` for function initialization
- Mock Firestore for database operations
- Mock Auth for authentication
- Local emulators for integration testing

Example:
```typescript
import * as functionsTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';

const testEnv = functionsTest();

// Mock Firestore
const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
};

jest.spyOn(admin, 'firestore').mockReturnValue(mockFirestore as any);
```

### Continuous Integration

Tests run automatically:
- On every commit (pre-commit hook)
- On pull requests (GitHub Actions)
- Before deployment

### When to Write Tests

**Always Write Tests For**:
- Business logic (voting algorithm, film selection)
- Authentication and authorization
- Data validation
- API endpoints
- Critical user flows

**Optional Tests For**:
- Simple getters/setters
- Type definitions
- Configuration files
- UI styling (visual regression instead)

### TDD Benefits for This Project

1. **Confidence**: Refactor without fear
2. **Documentation**: Tests show how code should be used
3. **Design**: TDD forces good API design
4. **Debugging**: Failing tests pinpoint issues
5. **Regression Prevention**: Bugs stay fixed

### Example TDD Session

```typescript
// 1. Write test
describe('createSession', () => {
  it('should create a session token', async () => {
    const visitorId = 'visitor-123';
    const token = await createSession(visitorId);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });
});

// 2. Run test (FAIL) ❌
// Error: createSession is not defined

// 3. Implement
export async function createSession(visitorId: string): Promise<string> {
  const token = uuidv4();
  await db.collection('sessions').doc(token).set({
    visitorId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return token;
}

// 4. Run test (PASS) ✅

// 5. Write next test
it('should store session in database', async () => {
  const visitorId = 'visitor-123';
  const token = await createSession(visitorId);

  const doc = await db.collection('sessions').doc(token).get();
  expect(doc.exists).toBe(true);
  expect(doc.data().visitorId).toBe(visitorId);
});

// 6. Run test, adjust code if needed, repeat...
```

### Getting Started with TDD

To begin development:

```bash
# 1. Set up Jest
cd functions
npm install --save-dev jest @types/jest ts-jest

# 2. Create first test
touch src/utils/db.test.ts

# 3. Write a failing test
# 4. Make it pass
# 5. Repeat
```

---

**Remember**: If you're not writing tests first, you're not doing TDD!
