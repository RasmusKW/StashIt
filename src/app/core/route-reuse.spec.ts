import { ActivatedRouteSnapshot, Route } from '@angular/router';
import { ParamAwareReuseStrategy } from './route-reuse';

function snapshot(routeConfig: Route, params: Record<string, string>): ActivatedRouteSnapshot {
  return { routeConfig, params } as unknown as ActivatedRouteSnapshot;
}

describe('ParamAwareReuseStrategy', () => {
  const strategy = new ParamAwareReuseStrategy();
  const nodeRoute: Route = { path: 'n/:id' };
  const homeRoute: Route = { path: '' };

  it('reuses only when route and params are identical', () => {
    expect(strategy.shouldReuseRoute(snapshot(nodeRoute, { id: 'a' }), snapshot(nodeRoute, { id: 'a' }))).toBe(true);
    expect(strategy.shouldReuseRoute(snapshot(nodeRoute, { id: 'a' }), snapshot(nodeRoute, { id: 'b' }))).toBe(false);
    expect(strategy.shouldReuseRoute(snapshot(homeRoute, {}), snapshot(nodeRoute, { id: 'a' }))).toBe(false);
  });
});
