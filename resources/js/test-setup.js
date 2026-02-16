// happy-dom's localStorage proxy may lack .clear() — provide a full Storage mock
const storage = new Map();

const localStorageMock = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
        return storage.size;
    },
    key: (index) => [...storage.keys()][index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
});
