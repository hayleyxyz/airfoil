 interface NACAOptions
{
    alpha?: number; // angle of attack in degrees
    c?: number;     // chord
    s?: number;     // number of points
    cs?: number;    // spacing: 0 linear, 1 cosine
    cte?: number;   // trailing edge: 0 opened, 1 closed
}

class NACAResult {
    x_e: number[]; // x coordinates of upper surface
    x_i: number[]; // x coordinates of lower surface
    y_e: number[]; // y coordinates of upper surface
    y_i: number[]; // y coordinates of lower surface
    x: number[];   // x coordinates (camber line)
    y_c: number[]; // y coordinates (camber line)

    constructor(
        x_e: number[],
        x_i: number[],
        y_e: number[],
        y_i: number[],
        x: number[],
        y_c: number[]
    ) {
        this.x_e = x_e;
        this.x_i = x_i;
        this.y_e = y_e;
        this.y_i = y_i;
        this.x = x;
        this.y_c = y_c;
    }
}

/**
 * NACA airfoil generator (ports MATLAB function to JavaScript).
 *
 * @param {number} n - NACA number (e.g. 2412, 23012, 6xxxx)
 * @param {Object} opts - optional parameters:
 *   { number } alpha   - angle of attack in degrees (default 0)
 *   { number } c       - chord (default 1)
 *   { number } s       - number of points (default 1000)
 *   { number } cs      - spacing: 0 linear, 1 cosine (default 1)
 *   { number } cte     - trailing edge: 0 opened, 1 closed (default 0)
 *
 * @returns { object } { x_e, x_i, y_e, y_i, x, y_c } (arrays, length s)
 */
function NACA(n: number, opts: NACAOptions = {}): NACAResult {
  // defaults
  const alphaDeg = opts.alpha ?? 0;
  const c = opts.c ?? 1;
  const s = opts.s ?? 1000;
  const cs = opts.cs ?? 1;
  const cte = opts.cte ?? 0;

  // determine series (nc)
  // replicate MATLAB checks for digits
  // TODO: Update checks
  let nc;
  if (Math.floor(n / 10_000_000) === 0) {
    if (Math.floor(n / 1_000_000) === 0) {
      if (Math.floor(n / 100_000) === 0) {
        if (Math.floor(n / 10_000) === 0) {
          nc = 4;
        } else {
          nc = 5;
        }
      } else {
        nc = 6;
      }
    } else {
      nc = 7;
    }
  } else {
    nc = 8;
  }

  // spacing x (0..1)
  let x = new Array(s);
  if (cs === 0) {
    // linear spacing
    for (let i = 0; i < s; i++) x[i] = i / (s - 1);
  } else {
    // cosine spacing (default)
    for (let i = 0; i < s; i++) {
      const beta = (i * Math.PI) / (s - 1);
      x[i] = (1 - Math.cos(beta)) / 2;
    }
  }

  const alpha = (alphaDeg * Math.PI) / 180; // radians
  const t = (n % 100) / 100; // thickness fraction
  let sym = 0;

  // preallocate
  const y_c = new Array(s).fill(0);
  const dyc_dx = new Array(s).fill(0);

  // thickness distribution y_t
  const y_t = new Array(s);
  for (let i = 0; i < s; i++) {
    const xi = x[i];
    // choose closed/open trailing edge coefficient
    const q4 = cte === 1 ? -0.1036 : -0.1015;
    y_t[i] =
      (t / 0.2) *
      (0.2969 * Math.sqrt(xi) - 0.126 * xi - 0.3516 * xi * xi + 0.2843 * xi * xi * xi + q4 * xi * xi * xi * xi);
  }

  // series-specific camber calculation
  if (nc === 4) {
    const m = Math.floor(n / 1000) / 100; // first digit /100
    const p = (Math.floor(n / 100) % 10) / 10; // second digit /10
    if (m === 0) {
      if (p === 0) sym = 1;
      else sym = 2;
    }

    for (let i = 0; i < s; i++) {
      const xi = x[i];
      if (xi < p) {
        // first region
        y_c[i] = (m * xi) / (p * p) * (2 * p - xi) + (0.5 - xi) * Math.sin(alpha);
        dyc_dx[i] = (2 * m) / (p * p) * (p - xi) / Math.cos(alpha) - Math.tan(alpha);
      } else {
        // second region
        y_c[i] =
          (m * (1 - xi)) / ((1 - p) * (1 - p)) * (1 + xi - 2 * p) + (0.5 - xi) * Math.sin(alpha);
        dyc_dx[i] = (2 * m) / ((1 - p) * (1 - p)) * (p - xi) / Math.cos(alpha) - Math.tan(alpha);
      }
    }
  } else if (nc === 5) {
    const p = (Math.floor(n / 1000) % 10) / 20; // 2nd digit /20
    const rn = Math.floor(n / 100) % 10; // 3rd digit

    if (rn === 0) {
      // standard camber
      // interpolation constants from MATLAB code
      const r = 3.33333333333212 * Math.pow(p, 3) + 0.700000000000909 * Math.pow(p, 2) + 1.19666666666638 * p - 0.00399999999996247;
      const k1 =
        1514933.33335235 * Math.pow(p, 4) -
        1087744.00001147 * Math.pow(p, 3) +
        286455.266669048 * Math.pow(p, 2) -
        32968.4700001967 * p +
        1420.18500000524;

      for (let i = 0; i < s; i++) {
        const xi = x[i];
        if (xi < r) {
          y_c[i] = (k1 / 6) * (Math.pow(xi, 3) - 3 * r * xi * xi + r * r * (3 - r) * xi) + (0.5 - xi) * Math.sin(alpha);
          dyc_dx[i] = (k1 / 6) * (3 * xi * xi - 6 * r * xi + r * r * (3 - r)) / Math.cos(alpha) - Math.tan(alpha);
        } else {
          y_c[i] = (k1 * Math.pow(r, 3)) / 6 * (1 - xi) + (0.5 - xi) * Math.sin(alpha);
          dyc_dx[i] = - (k1 * Math.pow(r, 3)) / (6 * Math.cos(alpha)) - Math.tan(alpha);
        }
      }
    } else if (rn === 1) {
      // reflexed camber
      const r = 10.6666666666861 * Math.pow(p, 3) - 2.00000000001601 * Math.pow(p, 2) + 1.73333333333684 * p - 0.0340000000002413;
      const k1 = -27973.3333333385 * Math.pow(p, 3) + 17972.8000000027 * Math.pow(p, 2) - 3888.40666666711 * p + 289.076000000022;
      const k2_k1 = 85.5279999999984 * Math.pow(p, 3) - 34.9828000000004 * Math.pow(p, 2) + 4.80324000000028 * p - 0.21526000000003;

      for (let i = 0; i < s; i++) {
        const xi = x[i];
        if (xi < r) {
          y_c[i] =
            (k1 / 6) * (Math.pow(xi - r, 3) - k2_k1 * Math.pow(1 - r, 3) * xi - Math.pow(r, 3) * xi + Math.pow(r, 3)) +
            (0.5 - xi) * Math.sin(alpha);
          dyc_dx[i] =
            (k1 / 6) * (3 * Math.pow(xi - r, 2) - k2_k1 * Math.pow(1 - r, 3) - Math.pow(r, 3)) / Math.cos(alpha) - Math.tan(alpha);
        } else {
          y_c[i] =
            (k1 / 6) * (k2_k1 * Math.pow(xi - r, 3) - k2_k1 * Math.pow(1 - r, 3) * xi - Math.pow(r, 3) * xi + Math.pow(r, 3)) +
            (0.5 - xi) * Math.sin(alpha);
          dyc_dx[i] =
            (k1 / 6) * (3 * k2_k1 * Math.pow(xi - r, 2) - k2_k1 * Math.pow(1 - r, 3) - Math.pow(r, 3)) / Math.cos(alpha) -
            Math.tan(alpha);
        }
      }
    } else {
      throw new Error('Incorrect NACA number: third digit (5-series) must be 0 or 1.');
    }
  } else if (nc === 6) {
    const ser = Math.floor(n / 100000); // 1st digit
    const a = (Math.floor(n / 10000) % 10) / 10; // 2nd digit
    const c_li = (Math.floor(n / 100) % 10) / 10; // 4th digit

    const g =
      -1 / (1 - a) * (a * a * (0.5 * Math.log(a) - 0.25) + 0.25);
    const h =
      1 / (1 - a) * (0.5 * Math.pow(1 - a, 2) * Math.log(1 - a) - 0.25 * Math.pow(1 - a, 2)) + g;

    if (ser === 6) {
      // vectorized-like evaluation, but loop to stay safe with logs and signs
      for (let i = 0; i < s; i++) {
        const xi = x[i];
        // For arguments to Math.log, keep MATLAB behaviour: log(0) => -Infinity
        const term1 = (1 / (1 - a)) * (0.5 * Math.pow(a - xi, 2) * Math.log(Math.abs(a - xi)) - 0.5 * Math.pow(1 - xi, 2) * Math.log(1 - xi) + 0.25 * Math.pow(1 - xi, 2) - 0.25 * Math.pow(a - xi, 2));
        y_c[i] = (c_li / (2 * Math.PI * (a + 1))) * (term1 - xi * Math.log(xi) + g - h * xi) + (0.5 - xi) * Math.sin(alpha);

        // dyc_dx expression translated from MATLAB (kept structure, mind logs and sign)
        // Note: replicate the MATLAB formula closely; some terms need sign(a-x) etc.
        // To avoid division by zero we rely on JS behavior (Infinity) matching MATLAB's -Inf.
        const sign_ax = Math.sign(a - xi);
        // Build inner complicated piece similarly to the MATLAB expression
        const inner =
          (xi / 2 - a / 2 +
            ((Math.log(1 - xi) * (2 * xi - 2)) / 2) +
            ((Math.log(Math.abs(a - xi)) * (2 * a - 2 * xi)) / 2) +
            (sign_ax * Math.pow(a - xi, 2)) / (2 * Math.abs(a - xi))
          );
        // Prevent NaN for zero denominators; let JS handle Infs as MATLAB would
        dyc_dx[i] =
          -(
            c_li *
            (h + Math.log(xi) - inner / (a - 1) + 1)
          ) / (2 * Math.PI * (a + 1) * Math.cos(alpha)) - Math.tan(alpha);
      }
    } else {
      throw new Error('NACA 6 Series must begin with 6.');
    }
  } else {
    throw new Error(`NACA ${nc} Series has not been implemented.`);
  }

  // final calculations
  const theta = new Array(s);
  for (let i = 0; i < s; i++) theta[i] = Math.atan(dyc_dx[i]);

  // rotate x coordinate according to alpha
  const x_rot = new Array(s);
  for (let i = 0; i < s; i++) {
    x_rot[i] = 0.5 - (0.5 - x[i]) * Math.cos(alpha);
  }

  // coordinates
  const x_e = new Array(s);
  const x_i = new Array(s);
  const y_e = new Array(s);
  const y_i = new Array(s);

  for (let i = 0; i < s; i++) {
    x_e[i] = (x_rot[i] - y_t[i] * Math.sin(theta[i])) * c;
    x_i[i] = (x_rot[i] + y_t[i] * Math.sin(theta[i])) * c;
    y_e[i] = (y_c[i] + y_t[i] * Math.cos(theta[i])) * c;
    y_i[i] = (y_c[i] - y_t[i] * Math.cos(theta[i])) * c;
  }

  // return arrays and some intermediate info
  return new NACAResult(
    x_e,
    x_i,
    y_e,
    y_i,
    x_rot.map((xi) => xi * c),
    y_c.map((v) => v * c)
  );
}

export { NACA };
