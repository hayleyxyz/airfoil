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
function NACA(n, opts = {}) {
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
  if (Math.floor(n / 1e7) === 0) {
    if (Math.floor(n / 1e6) === 0) {
      if (Math.floor(n / 1e5) === 0) {
        if (Math.floor(n / 1e4) === 0) {
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
  return {
    x_e,
    x_i,
    y_e,
    y_i,
    // extras if user wants to inspect
    x: x_rot.map((xi) => xi * c),
    y_c: y_c.map((v) => v * c),
  };
}

// --- Utility functions -----------------------------------------------------

function linspace(start, stop, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(start + (stop - start) * (i / (n - 1)));
    }
    return arr;
}

// Cubic spline interpolation (faithful port of Python code)
function interpolate(xa, ya, queryPoints) {
    const n = xa.length;
    const u = new Array(n).fill(0);
    const y2 = new Array(n).fill(0);

    for (let i = 1; i < n - 1; i++) {
        const wx = xa[i + 1] - xa[i - 1];
        const sig = (xa[i] - xa[i - 1]) / wx;
        const p = sig * y2[i - 1] + 2.0;

        y2[i] = (sig - 1.0) / p;

        const ddydx =
            (ya[i + 1] - ya[i]) / (xa[i + 1] - xa[i]) -
            (ya[i] - ya[i - 1]) / (xa[i] - xa[i - 1]);
        u[i] = (6.0 * ddydx / wx - sig * u[i - 1]) / p;
    }

    // Back substitution
    for (let i = n - 2; i >= 0; i--) {
        y2[i] = y2[i] * y2[i + 1] + u[i];
    }

    const results = [];
    for (let qp of queryPoints) {
        let klo = 0;
        let khi = n - 1;

        // Binary search
        while (khi - klo > 1) {
            let k = Math.floor((khi + klo) / 2);
            if (xa[k] > qp) khi = k;
            else klo = k;
        }

        const h = xa[khi] - xa[klo];
        const a = (xa[khi] - qp) / h;
        const b = (qp - xa[klo]) / h;

        const val =
            a * ya[klo] +
            b * ya[khi] +
            ((a * a * a - a) * y2[klo] +
                (b * b * b - b) * y2[khi]) *
                (h * h) /
                6.0;

        results.push(val);
    }

    return results;
}

// --- NACA 4-digit ---------------------------------------------------------

function naca4(number, n, finiteTE = false, halfCosine = false) {
    const m = parseFloat(number[0]) / 100.0;
    const p = parseFloat(number[1]) / 10.0;
    const t = parseFloat(number.slice(2)) / 100.0;

    const a0 = 0.2969;
    const a1 = -0.1260;
    const a2 = -0.3516;
    const a3 = 0.2843;
    const a4 = finiteTE ? -0.1015 : -0.1036;

    let x;
    if (halfCosine) {
        const beta = linspace(0, Math.PI, n + 1);
        x = beta.map(b => 0.5 * (1 - Math.cos(b)));
    } else {
        x = linspace(0, 1, n + 1);
    }

    const yt = x.map(xx =>
        5 * t * (
            a0 * Math.sqrt(xx) +
            a1 * xx +
            a2 * xx ** 2 +
            a3 * xx ** 3 +
            a4 * xx ** 4
        )
    );

    const xc1 = x.filter(xx => xx <= p);
    const xc2 = x.filter(xx => xx > p);

    let xu, yu, xl, yl;

    if (p === 0) {
        xu = [...x];
        yu = [...yt];
        xl = [...x];
        yl = yt.map(v => -v);
    } else {
        const yc1 = xc1.map(xx => m / p ** 2 * xx * (2 * p - xx));
        const yc2 = xc2.map(xx => m / (1 - p) ** 2 * (1 - 2 * p + xx) * (1 - xx));
        const zc = [...yc1, ...yc2];

        const dyc1 = xc1.map(xx => m / p ** 2 * (2 * p - 2 * xx));
        const dyc2 = xc2.map(xx => m / (1 - p) ** 2 * (2 * p - 2 * xx));
        const dyc = [...dyc1, ...dyc2];

        const theta = dyc.map(v => Math.atan(v));

        xu = x.map((xx, i) => xx - yt[i] * Math.sin(theta[i]));
        yu = x.map((_, i) => zc[i] + yt[i] * Math.cos(theta[i]));
        xl = x.map((xx, i) => xx + yt[i] * Math.sin(theta[i]));
        yl = x.map((_, i) => zc[i] - yt[i] * Math.cos(theta[i]));
    }

    const X = [...xu].reverse().concat(xl.slice(1));
    const Z = [...yu].reverse().concat(yl.slice(1));

    return [X, Z];
}

const defaultNumberOfPoints = 40; // TODO: increase for smoother mesh

function buildBladeSimple() {
    const profile = naca4coords(0.02, 0.10, defaultNumberOfPoints);

    console.log(profile);

    const verts = [], indices = [];
    const span = 1.0, rootChord = 0.5, tipChord = 0.15, twistDeg = 45;
    const sections = 1; // TODO: increase for smoother mesh

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;
        const chord = rootChord * (1 - t) + tipChord * t;
        const spanPos = t * span;
        const twist = twistDeg * Math.PI / 180 * t;
        for (let p = 0; p < profile.length; p++) {
            const u = profile[p][0], v = profile[p][1];
            const px = (u - 0.25) * chord;
            const py = v * chord;
            const pz = 0;
            const cosT = Math.cos(twist), sinT = Math.sin(twist);
            const rx = px * cosT - pz * sinT;
            const rz = px * sinT + pz * cosT;
            verts.push(rx, spanPos - span / 2, rz);
        }
    }

    // Connect faces
    let ring = profile.length;
    for (let s = 0; s < sections; s++) {
        const base = (s * profile.length);
        for (let i = 0; i < profile.length - 1; i++) {
            const a = base + i;
            const b = base + i + 1;
            const c = base + i + profile.length;
            const d = base + i + profile.length + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }


    return { verts, indices };
}

function buildBladeWithThickness() {
    const profile = naca4coords(0.02, 0.10, defaultNumberOfPoints);

    console.log(profile);

    const verts = [], indices = [];
    const span = 1.0, rootChord = 0.5, tipChord = 0.15, twistDeg = 45;
    const sections = 1; // TODO: increase for smoother mesh

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;
        const chord = rootChord * (1 - t) + tipChord * t;
        const spanPos = t * span;
        const twist = twistDeg * Math.PI / 180 * t;
        for (let p = 0; p < profile.length; p++) {
            const u = profile[p][0], v = profile[p][1];
            const px = (u - 0.25) * chord;
            const py = v * chord;
            const pz = 0;
            const cosT = Math.cos(twist), sinT = Math.sin(twist);
            const rx = px * cosT - pz * sinT;
            const rz = px * sinT + pz * cosT;
            verts.push(rx, spanPos - span / 2, rz);
        }
    }

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;
        const chord = rootChord * (1 - t) + tipChord * t;
        const spanPos = t * span;
        const twist = twistDeg * Math.PI / 180 * t;
        for (let p = 0; p < profile.length; p++) {
            const u = profile[p][0], v = profile[p][1];
            const px = (u - 0.25) * chord;
            const py = v * chord;
            const pz = 0;
            const cosT = Math.cos(twist), sinT = Math.sin(twist);
            const rx = px * cosT - pz * sinT;
            const rz = px * sinT + pz * cosT;
            verts.push(rx, spanPos - span / 2, rz + 0.1); // z + 0.1 offset for thickness
        }
    }


    // Connect faces
    let ring = profile.length;
    for (let s = 0; s < sections; s++) {
        const base = (s * profile.length);
        for (let i = 0; i < profile.length - 1; i++) {
            const a = base + i;
            const b = base + i + 1;
            const c = base + i + profile.length;
            const d = base + i + profile.length + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }


    for (let s = 0; s < sections; s++) {
        const base = (s * profile.length) + (profile.length * (sections + 1));
        for (let i = 0; i < profile.length - 1; i++) {
            const a = base + i;
            const b = a + 1;
            const c = a + profile.length;
            const d = a + profile.length + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    for (let s = 0; s < sections; s++) {
        const base = (s * profile.length);
        for (let i = 0; i < profile.length - 1; i++) {
            const a = base + i;
            const b = a + 1;
            const c = a + profile.length + (profile.length * sections);
            const d = c + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
            
            const a2 = base + i + profile.length - 1;
            const b2 = a2 + 1;
            const c2 = a2 + profile.length + (profile.length * sections);
            const d2 = c2 + 1;
            indices.push(a2, b2, c2);
            indices.push(b2, d2, c2);

            const a3 = base + i;
            const b3 = a3 + profile.length;
            const c3 = a3 + profile.length + (profile.length * sections);
            const d3 = c3 + profile.length;
            indices.push(a3, b3, c3);
            indices.push(b3, d3, c3);

            const a4 = base + i + 1;
            const b4 = a4 + profile.length;
            const c4 = a4 + profile.length + (profile.length * sections);
            const d4 = c4 + profile.length;
            indices.push(a4, b4, c4);
            indices.push(b4, d4, c4);
        }
    }



    return { verts, indices };
}


// === Blade mesh generator ===
function buildBlade(numberOfPoints = defaultNumberOfPoints) {
    const profile = naca4coords(0.02, 0.10, numberOfPoints);
    const verts = [], indices = [];
    const span = 1.0, rootChord = 0.5, tipChord = 0.15, twistDeg = 45;
    const sections = 40; // TODO: increase for smoother mesh

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;
        const chord = rootChord * (1 - t) + tipChord * t;
        const spanPos = t * span;
        const twist = twistDeg * Math.PI / 180 * t;
        for (let p = 0; p < profile.length; p++) {
            const u = profile[p][0], v = profile[p][1];
            const px = (u - 0.25) * chord;
            const py = v * chord;
            const pz = 0;
            const cosT = Math.cos(twist), sinT = Math.sin(twist);
            const rx = px * cosT - pz * sinT;
            const rz = px * sinT + pz * cosT;
            verts.push(rx, spanPos - span / 2, rz);
        }
    }

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;
        const chord = rootChord * (1 - t) + tipChord * t;
        const spanPos = t * span;
        const twist = twistDeg * Math.PI / 180 * t;
        for (let p = 0; p < profile.length; p++) {
            const u = profile[p][0], v = profile[p][1];
            const px = (u - 0.25) * chord;
            const py = v * chord;
            const pz = 0;
            const cosT = Math.cos(twist), sinT = Math.sin(twist);
            const rx = px * cosT - pz * sinT;
            const rz = px * sinT + pz * cosT;
            //verts.push(rx, spanPos - span / 2, rz);
        }
    }
    

    let ring = profile.length;
    for (let s = 0; s < sections; s++) {
        const base = (s * ring);
        for (let i = 0; i < ring - 1; i++) {
            const a = base + i;
            const b = base + i + 1;
            const c = base + i + ring;
            const d = base + i + ring + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    ring = profile.length;
    for (let s = sections; s <= sections + sections; s++) {
        const base = (s * ring);
        for (let i = 0; i < ring - 1; i++) {
            const a = base + i;
            const b = base + i + 1;
            const c = base + i + ring;
            const d = base + i + ring + 1;
            //indices.push(a, b, c);
            //indices.push(b, d, c);
        }
    }

    return { verts, indices };
}

function thicken(meshData) {
    const newVerts = meshData.verts.slice();
    const newIndices = meshData.indices.slice();
    const offset = meshData.verts.length / 3;
    const thickness = 0.02;

    // Duplicate vertices with offset in Z
    for (let i = 0; i < meshData.verts.length / 3; i++) {
        newVerts.push(meshData.verts[i * 3], meshData.verts[i * 3 + 1], meshData.verts[i * 3 + 2] + thickness);
    }

    // Duplicate faces for the back side
    for (let i = 0; i < meshData.indices.length; i += 3) {
        const a = meshData.indices[i] + offset;
        const b = meshData.indices[i + 1] + offset;
        const c = meshData.indices[i + 2] + offset;
        newIndices.push(c, b, a); // reverse order for correct normal
    }

    // Create side faces
    const ring = (meshData.verts.length / 3) / (defaultNumberOfPoints * 2);
    for (let s = 0; s < ring; s++) {
        const base = s * (defaultNumberOfPoints * 2);
        for (let i = 0; i < defaultNumberOfPoints * 2 - 1; i++) {
            const a = base + i, b = base + i + 1, c = base + i + offset, d = base + i + 1 + offset;
            newIndices.push(a, b, c);
            newIndices.push(b, d, c);
        }
    }

    return { verts: newVerts, indices: newIndices };
}

// === Export to OBJ ===
function exportOBJ(mesh) {
    let obj = '';

    // vertices
    for (let i = 0; i < mesh.verts.length; i += 3) {
        obj += `v ${mesh.verts[i]} ${mesh.verts[i + 1]} ${mesh.verts[i + 2]}\n`;
    }

    // faces (1-indexed)
    for (let i = 0; i < mesh.indices.length; i += 3) {
        obj += `f ${mesh.indices[i] + 1} ${mesh.indices[i + 1] + 1} ${mesh.indices[i + 2] + 1}\n`;
    }

    return obj;
}

export { buildBlade, exportOBJ, thicken, buildBladeSimple, NACA };