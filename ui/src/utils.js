// Some utilities for the whole project.
export const Utils = {
  // Copy object, with optional extras fields, for example:
  //    copy({id: 0}, ['msg': 'hi'])
  // Return an object:
  //    {id: 0, msg: 'hi'}
  copy: (from, extras) => {
    let cp = Utils.merge({}, from);

    for (let i = 0; i < extras?.length; i += 2) {
      const k = extras[i];
      const v = extras[i + 1];
      const ov = cp[k];

      const obj = {};
      obj[k] = Utils.merge(ov, v);
      cp = Utils.merge(cp, obj);
    }
    return cp;
  },
  // Merge two object, rewrite dst by src fields.
  merge: (dst, src) => {
    if (typeof dst !== 'object') return src;
    if (typeof src !== 'object') return src;

    const cp = {};
    for (const k in dst) {
      cp[k] = dst[k];
    }
    for (const k in src) {
      cp[k] = src[k];
    }
    return cp;
  }
};

export const SimpleStrategyStorage = {
  saveFilter: (iface, protocol, direction, identifyKey, identifyValue) => {
    localStorage.setItem('TC_UI_SIMPLE_STRATEGY_FILTER', JSON.stringify({
      iface, protocol, direction, identifyKey, identifyValue,
    }));
  },
  loadFilter: () => {
    const info = localStorage.getItem('TC_UI_SIMPLE_STRATEGY_FILTER');
    return info ? JSON.parse(info) : null;
  },
  clearFilter: () => {
    localStorage.removeItem('TC_UI_SIMPLE_STRATEGY_FILTER');
  },
  saveStrategy: (strategy, loss, delay, rate, delayDistro) => {
    localStorage.setItem('TC_UI_SIMPLE_STRATEGY_STRATEGY', JSON.stringify({
      strategy, loss, delay, rate, delayDistro,
    }));
  },
  loadStrategy: () => {
    const info = localStorage.getItem('TC_UI_SIMPLE_STRATEGY_STRATEGY');
    return info ? JSON.parse(info) : null;
  },
  clearStrategy: () => {
    localStorage.removeItem('TC_UI_SIMPLE_STRATEGY_STRATEGY');
  }
};
