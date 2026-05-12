const logger = require('./logger');

class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldownMs = 30000, windowMs = 300000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.windowMs = windowMs;
    this.failures = [];
    this.isOpen = false;
    this.openedAt = null;
  }

  recordFailure() {
    const now = Date.now();
    this.failures = this.failures.filter(t => now - t < this.windowMs);
    this.failures.push(now);
    if (this.failures.length >= this.failureThreshold) {
      this.isOpen = true;
      this.openedAt = now;
      logger.warn('Circuit breaker OPEN', {
        failures: this.failures.length,
        threshold: this.failureThreshold,
      });
    }
  }

  recordSuccess() {
    this.failures = [];
    this.isOpen = false;
    this.openedAt = null;
  }

  canExecute() {
    if (!this.isOpen) return true;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.isOpen = false;
      this.failures = [];
      this.openedAt = null;
      logger.info('Circuit breaker recovered');
      return true;
    }
    return false;
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failures.length,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
    };
  }
}

module.exports = CircuitBreaker;
