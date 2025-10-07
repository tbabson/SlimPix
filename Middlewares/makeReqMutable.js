// --- add this BEFORE app.use(xss()); ---

/**
 * Ensure req.query and req.params are plain, writable objects so
 * middlewares that assign to them (e.g. xss-clean) won't throw.
 *
 * This intentionally makes shallow copies; that's enough for typical sanitizers.
 */
function makeReqMutable(req, res, next) {
    try {
        // Make writable copy of req.query if present
        const q = req.query;
        // Only overwrite if it's not already a plain writable object
        // (we just create a safe shallow clone that is definitely writable)
        Object.defineProperty(req, 'query', {
            value: (q && typeof q === 'object') ? { ...q } : {},
            writable: true,
            configurable: true,
            enumerable: true
        });
    } catch (err) {
        // If defineProperty fails, just continue (xss-clean may still break)
        console.warn('makeReqMutable: failed to define req.query property:', err && err.message);
    }

    try {
        const p = req.params;
        Object.defineProperty(req, 'params', {
            value: (p && typeof p === 'object') ? { ...p } : {},
            writable: true,
            configurable: true,
            enumerable: true
        });
    } catch (err) {
        console.warn('makeReqMutable: failed to define req.params property:', err && err.message);
    }

    next();
}

export default makeReqMutable;