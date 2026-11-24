import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Creates a fresh page component when the route parameters change (e.g. going from one node
 * to another), so per-page state such as the search field and quick-add starts clean.
 */
@Injectable()
export class ParamAwareReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    const a = future.params;
    const b = curr.params;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (a[key] !== b[key]) return false;
    return true;
  }
}
