const roleCache = new Map();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export function getRolesFromCache(userId) {
    const cached = roleCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.roles;
    }
    return null;
}

export function setRolesInCache(userId, roles) {
    roleCache.set(userId, {
        roles,
        timestamp: Date.now()
    });
}