# Syncplay: 2D Vehicle Physics API v1

Import the 2D vehicle dynamics engine from `@series-inc/rundot-syncplay`.

Inspired by Pat Kerr's classic 1996 Grand Theft Auto vehicle physics prototype, this module brings high-fidelity, deterministic top-down vehicle dynamics to Syncplay. It features multi-wheel point kinematics, responsive arcade damping, simulation friction circles, handbrake power-slides, dynamic weight transfer, anti-oscillation zero-speed stopping, surface friction modulation, and bit-identical rollback determinism.

## Quickstart

```typescript
import {
  initPhysics2D,
  createPhysicsWorld2D,
  meters,
  radians,
  newtons,
} from '@series-inc/rundot-syncplay/physics/2d';
import {
  DEFAULT_CAR_2D,
  createDeterministicVehicleState2D,
  stepDeterministicVehicleState2D,
} from '@series-inc/rundot-syncplay';

await initPhysics2D();

const world = createPhysicsWorld2D({
  tickRate: 60,
  initialGravity: { x: 0, y: 0 }, // Top-down planar physics
  capacity: { bodies: 64, joints: 16, fluids: 0, contacts: 128 },
});

// Create dynamic chassis body in PhysicsWorld2D
const { created } = world.edit(ops => ops.createBody({
  kind: 'dynamic',
  shape: { type: 'box', halfX: meters(1.8), halfY: meters(0.9) },
  mass: 1200,
  inertia: 1600,
}));
const chassisId = world.readBody(created).id;

// Initialize deterministic vehicle state
let vehicleState = createDeterministicVehicleState2D(chassisId, DEFAULT_CAR_2D);

// Inside your deterministic fixed game tick:
function onTick(inputs) {
  // Step vehicle before world.step()
  const result = stepDeterministicVehicleState2D(
    DEFAULT_CAR_2D,
    vehicleState,
    {
      throttle: inputs.forward - inputs.backward, // -1.0 to +1.0
      steer: inputs.right - inputs.left,          // -1.0 to +1.0
      brake: inputs.brake ? 1.0 : 0.0,
      handbrake: inputs.handbrake,
    },
    world,
    {
      surfaceFrictionProvider: (wheelIndex, worldX, worldY) => {
        return isIce(worldX, worldY) ? 0.15 : 1.0;
      },
    }
  );

  vehicleState = result.state;
  world.step();

  // Inspect telemetry for renderers, particles, and skid marks
  if (vehicleState.telemetry.isDrifting) {
    emitDriftSmoke(vehicleState.chassisId);
  }
}
```

## Public API & Types

### 1. `DEFAULT_CAR_2D` & `DEFAULT_BIKE_2D`
Pre-tuned, turn-key vehicle definitions for standard 4-wheel cars and 2-wheel motorbikes.

### 2. `parseVehicleDefinition2D(definition)`
Validates, normalizes, and deep-freezes a vehicle definition. Throws descriptive `kinetix.vehicle2d.definition-invalid` errors if anchors, wheels, or forces are malformed.

### 3. `createDeterministicVehicleState2D(chassisId, definition)`
Creates the initial, canonical `DeterministicVehicleState2D` bound to the specified `PhysicsBodyId2D`.

### 4. `stepDeterministicVehicleState2D(definition, state, input, world, options)`
Advances the vehicle simulation by one physics step ($\Delta t = \text{world.info().fixedDt}$):
- Computes speed-sensitive steering angle rate limits.
- Evaluates per-wheel point velocities $\vec{V}_i = \vec{V} + \vec{\omega} \times \vec{r}_i$.
- Resolves forward rolling resistance, drive thrust, and effective-mass stopping impulses.
- Resolves lateral cornering forces (Arcade damping or Simulation friction circle).
- Modulates available grip and drag when the handbrake is engaged.
- Computes dynamic longitudinal and lateral weight transfer ($\Delta F_N$).
- Applies total force and yaw torque to the chassis body in `PhysicsWorld2D`.
- Generates comprehensive wheel telemetry, slip velocities, and drift flags.

### 5. Checkpoint & Rollback Codecs
- `encodeDeterministicVehicleState2D(state): string`
- `decodeDeterministicVehicleState2D(json): DeterministicVehicleState2D`
- `encodeDeterministicVehicleState2DBytes(state): Uint8Array`
- `decodeDeterministicVehicleState2DBytes(bytes): DeterministicVehicleState2D`

All states are guaranteed 100% deterministic and losslessly serializable across network synchronization, client replays, and rollback state restores.

## Vehicle Mechanics & Dynamics

### Arbitrary Multi-Wheel Layouts
Wheels are defined by local offsets $(x, y)$ from the chassis center of mass:
- **Steered:** Rotates with user steering input ($\delta = \text{steer} \cdot \delta_{\text{max}} \cdot R_{\text{speed}}$).
- **Driven:** Receives engine thrust (supports FWD, RWD, AWD, or multi-axle haulers).
- **Handbraked:** Affected by e-brake actuation (locks wheel spin and reduces lateral grip).
- **Brake Ratio:** Apportions braking force between axles (e.g. 60% front, 40% rear).

### Handbrake Drift Dynamics
When `handbrake: true` is requested:
1. Wheels flagged with `handbraked: true` experience reduced lateral grip ($\mu_{\text{effective}} = \mu_{\text{base}} \times \mu_{\text{handbrake}}$, default $0.3$).
2. Longitudinal braking increases to lock the wheel ($v_{\text{wheel}} = 0$).
3. In a turn, front wheels generate full centripetal force while rear grip is broken, producing an oversteer torque that rotates the vehicle into a controllable slide. Counter-steering neutralizes the yaw moment, allowing sustained power-slides.

### Anti-Oscillation Zero-Speed Clamping
Unlike naive velocity damping or sign-based braking ($F = -\text{sgn}(v) F_{\text{brake}}$), which causes high-frequency oscillations across $v = 0$, Syncplay 2D vehicle physics calculates each wheel's effective mass $M_{\text{eff}}^{-1} = 1/m + (\vec{r} \times \vec{u})^2 / I$ and limits braking impulse to the exact momentum required to halt the chassis. When vehicle speed is below `stopThresholdVelocity` (default $0.08\text{ m/s}$) with neutral throttle, the chassis snaps to a dead stop and transitions to `sleep: 'parked'`.

### Dynamic Weight Transfer
Under acceleration, braking, or hard cornering, chassis inertia shifts contact normal force:
$$\Delta F_{N, \text{long}} = \frac{m \cdot a_{\text{long}} \cdot h_{\text{cg}}}{L_{\text{wheelbase}}}, \quad \Delta F_{N, \text{lat}} = \frac{m \cdot a_{\text{lat}} \cdot h_{\text{cg}}}{W_{\text{track}}}$$
- Front wheels gain grip under heavy braking, inducing oversteer on turn-in.
- Rear wheels gain grip under hard acceleration, improving straight-line traction.
- For 2-wheel vehicles (motorbikes), $W_{\text{track}} = 0$ safely disables lateral transfer without division by zero.

## Telemetry & Skid Marks

Each wheel state exposes real-time telemetry:
- `lateralSlipVelocity`: magnitude of sideways sliding (in m/s).
- `longitudinalSlipVelocity`: wheel spin or lockup speed difference.
- `skidding`: boolean indicating whether the tire has exceeded the traction threshold.
- `normalLoad`: current vertical contact force in Newtons.

The vehicle telemetry block provides:
- `speed`: chassis ground speed in m/s.
- `driftAngle`: slip angle between chassis heading and velocity vector.
- `isDrifting`: true when rear wheels are skidding with significant drift angle at speed.
- `forwardG` & `lateralG`: G-forces for cockpit head-bob and camera shake.
