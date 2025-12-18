import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import GUI from 'lil-gui';
import { NACA } from './naca';
import nacaDatList from './naca-dat-files';

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.001, 100 );
camera.position.set( 0.3, 0.15, 0.8 );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

window.addEventListener( 'resize', function( event: UIEvent ) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );
} );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0.4, 0,0 );
controls.update();

const hemi = new THREE.HemisphereLight( 0xffffff, 0x888888, 0.9 );
scene.add( hemi );
const dir = new THREE.DirectionalLight( 0xffffff, 0.8 );
dir.position.set( 1, 1, 1 );
scene.add( dir );

const grid = new THREE.GridHelper( 2, 40, 0xdddddd, 0xeeeeee );
grid.rotation.x = Math.PI / 2;
scene.add( grid );

const axes = new THREE.AxesHelper( 0.5 );
scene.add( axes );

const meshGroup = new THREE.Group();
scene.add( meshGroup );

const map = new THREE.TextureLoader().load( 'textures/uv_grid_opengl.jpg' );
map.wrapS = map.wrapT = THREE.RepeatWrapping;
map.anisotropy = 16;
map.colorSpace = THREE.SRGBColorSpace;

const path = 'textures/cube/pisa/';
const urls = [ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ];

const textureCube = new THREE.CubeTextureLoader().setPath( path ).load( urls );

const materials = {
  wireframe: new THREE.MeshBasicMaterial( { wireframe: true } ),
  flat: new THREE.MeshPhongMaterial( { specular: 0x000000, flatShading: true, side: THREE.DoubleSide } ),
  smooth: new THREE.MeshLambertMaterial( { side: THREE.DoubleSide } ),
  glossy: new THREE.MeshPhongMaterial( { color: 0xc0c0c0, specular: 0x404040, shininess: 300, side: THREE.DoubleSide } ),
  textured: new THREE.MeshPhongMaterial( { map: map, side: THREE.DoubleSide } ),
  reflective: new THREE.MeshPhongMaterial( { envMap: textureCube, side: THREE.DoubleSide } ),
};

// === GUI ===

const gui = new GUI();

const config = {
  resetGuiState,

  material: 'glossy',
  drawLines: true,
  wireframeColour: '#ffffff',
  drawGrid: true,

  span: 0.2,
  enableTwist: true,
  twist: 0,
  enableScale: false,
  rootScale: 1,
  tipScale: 1,
  aoa: 0,

  createFromDat: false,
  nacaDat: 'n6409-il',

  naca: '2412',
  spacing: 'cosine',
  chord: 1,
  sections: 48,
  
  exportOBJ,
  viewOBJ,
  screenshot,
  exportDAT,
  
};

gui.add( config, 'resetGuiState' ).name ('Reset' );

const drawingOpts = gui.addFolder( 'Drawing' );
drawingOpts.add( config, 'material', Object.keys( materials ) ).name( 'Material' );
drawingOpts.add( config, 'drawLines' ).name( 'Draw Lines' );
drawingOpts.addColor( config, 'wireframeColour' ).name( 'Line Colour' );
drawingOpts.add( config, 'drawGrid' ).name( 'Draw Grid' );

const extrusionOpts = gui.addFolder( 'Extrusion' );
extrusionOpts.add( config, 'span', 0.0, 5 ).name( 'Span' ).step( 0.01 );
extrusionOpts.add( config, 'enableTwist' ).name( 'Enable Twist' );
extrusionOpts.add( config, 'twist', -90, 90 ).name( 'Twist (deg)' ).step( 1 );
extrusionOpts.add( config, 'aoa', -90, 90 ).name( 'AOA' ).step( 1 );

extrusionOpts.add( config, 'enableScale' ).name( 'Enable Scale' );
extrusionOpts.add( config, 'rootScale', 0.01, 2 ).name( 'Root Scale' ).step( 0.01 );
extrusionOpts.add( config, 'tipScale', 0.01, 2 ).name( 'Tip Scale' ).step( 0.01 );


const datOptsa = gui.addFolder( 'NACA .dat' );

datOptsa.add( config, 'createFromDat' ).name( 'Create from .dat' )
  .listen();

datOptsa.add( config, 'nacaDat', nacaDatList ).name( 'NACA .dat' )
  .onChange( ( v ) => {
    config.createFromDat = true;
  } );

const genOpts = gui.addFolder( 'Generation' );
genOpts.add( config, 'naca' ).name( 'NACA 4-digit' )
  .onChange( ( v ) => {
    config.createFromDat = false;
  } );

genOpts.add( config, 'spacing', ['cosine', 'linear' ] ).name( 'Spacing' );
genOpts.add( config, 'chord', 0.1,  2 ).name( 'Chord' ).step( 0.01 );
genOpts.add( config, 'sections', 4, 1_000 ).name( 'Sections' ).step( 1 );

const exportOpts = gui.addFolder( 'Export' );
exportOpts.add( config, 'exportOBJ' ).name( 'Export OBJ' );
exportOpts.add( config, 'viewOBJ' ).name( 'View OBJ' );
exportOpts.add( config, 'screenshot' ).name( 'Screenshot' );
exportOpts.add( config, 'exportDAT' ).name( 'Export DAT' );

gui.onFinishChange( function ( event ): void {
  saveGuiState();
  create();
} );

function loadGuiState(): void {
  if ( window.history.state ) {
    gui.load( window.history.state );
  } else if ( window.location.hash ) {
    let payload = window.location.hash.substring( 1 );
    payload = JSON.parse( decodeURIComponent( payload ) );

    gui.load( payload );
  }
}

function isGuiStateInitial(): boolean {
  for ( const c of gui.controllersRecursive() ) {
    if ( c.getValue() !== c.initialValue ) {
      return false;
    }
  }

  return true;
}

function saveGuiState(): void {
  if ( isGuiStateInitial() ) {
    window.history.replaceState( null, window.document.title, window.location.pathname );
  } else {
    const saved = gui.save( true );

    window.history.replaceState( saved, window.document.title, '#' + JSON.stringify( saved ) );
  }
}

function resetGuiState(): void {
  gui.reset();
}

THREE.Cache.enabled = true;
const loader = new THREE.FileLoader();

function parseNacaDat( data: string ): THREE.Vector2[] {
  const lines = data.split( '\n' );
    const points = [];

    for ( let i = 1; i < lines.length; i++ ) {
      const line = lines[i].trim();

      if ( line === '' ) {
        continue;
      }

      const parts = line.split( /\s+/ );

      if ( parts.length < 2 ) {
        continue;
      }

      const x = parseFloat( parts[0] );
      const y = parseFloat( parts[1] );

      if ( isNaN( x ) || isNaN( y ) ) {
        continue;
      }

      points.push( new THREE.Vector2( x, y ) );
    }

    return points;
}

async function load( naca: string ): Promise<THREE.Vector2[]> {
  return new Promise( ( resolve, reject ) => {
    loader.load(`airfoils/${naca}.dat`, function ( data: string ) {
      const points = parseNacaDat( data );

      resolve( points );
    } );
  } );
}

function clearGroup( g ): void {
  while ( g.children.length ) {
    const c = g.children.pop();

    if ( c.geometry ) {
      c.geometry.dispose();
    }

    if ( c.material ) {
      if ( Array.isArray( c.material ) ) {
        c.material.forEach( ( m ) => m.dispose() );
      }
      else {
        c.material.dispose();
      }
    }
  }
}

function extrudeWithTwist( shape: THREE.Shape, span: number, twist: number, steps: number = 80 ): THREE.ExtrudeGeometry {
  // Straight path along Z
  const straightZPoints = [];

  for ( let i = 0; i <= steps; i++ ) {
    const t = i / steps;
    straightZPoints.push( new THREE.Vector3( 0, 0, t * span ) );
  }

  const path = new THREE.CatmullRomCurve3( straightZPoints );

  // Generate extrude geometry without bevel
  const extrudeSettings = {
    steps,
    depth: steps,
    bevelEnabled: false,
    extrudePath: path
  };

  const geom = new THREE.ExtrudeGeometry( shape, extrudeSettings );
  geom.rotateZ( Math.PI / 2 ); // rotate so z is config.span

  // Apply twist: rotate cross-section according to distance along span
  const pos = geom.attributes.position;
  const vert = new THREE.Vector3();

  for ( let i = 0; i < pos.count; i++ ) {
    vert.fromBufferAttribute( pos, i );

    // Normalized height along span (0 → 1)
    const t = ( vert.z + span / 2 ) / span;

    // Twist angle in radians
    const angle = THREE.MathUtils.degToRad( twist * t );

    // Rotate around Z (extrusion axis)
    const x = vert.x * Math.cos( angle ) - vert.y * Math.sin( angle );
    const y = vert.x * Math.sin( angle ) + vert.y * Math.cos( angle );

    pos.setXYZ( i, x, y, vert.z );
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();

  return geom;
}

function scaleAlongZ( geometry: THREE.ExtrudeGeometry, rootScale: number, tipScale: number ): THREE.ExtrudeGeometry {
  const position = geometry.attributes.position;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  for ( let i = 0; i < position.count; i++ ) {
    const z = position.getZ( i );

    // normalize z → 0..1
    const t = z / config.span;

    // scale factor (small at start, big at end)
    const scale = THREE.MathUtils.lerp( config.rootScale, config.tipScale, t );

    position.setX( i, position.getX( i ) * scale );
    position.setY( i, position.getY( i ) * scale );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

function createFromPoints( points: THREE.Vector2[] ): void {
  clearGroup( meshGroup );

  const shape = new THREE.Shape( points );

  let geom: THREE.ExtrudeGeometry | THREE.ShapeGeometry;

  if ( config.span === 0 ) {
    // Just a one-sided polygonal geometry
    geom = new THREE.ShapeGeometry( shape );

    geom.rotateZ( THREE.MathUtils.degToRad( -config.aoa ) );
    geom.scale( config.rootScale, config.rootScale, config.rootScale );
  }
  else {
    if ( ! config.enableTwist ) {
      // simple extrusion
      geom = new THREE.ExtrudeGeometry( shape, {
        steps: config.sections,
        depth: config.span,
        bevelEnabled: false,
      } );
    } else {
      geom = extrudeWithTwist( shape, config.span, -config.twist, config.sections );
    }

    geom.rotateZ( THREE.MathUtils.degToRad( -config.aoa ) );

    if ( config.enableScale ) {
      geom = scaleAlongZ( geom, config.rootScale, config.tipScale );
    }
  }

  const mesh = new THREE.Mesh( geom, materials[config.material] );
  meshGroup.add( mesh );

  // bounding box & camera framing
  const box = new THREE.Box3().setFromObject( meshGroup );

  const size = new THREE.Vector3();
  box.getSize( size );

  const center = new THREE.Vector3();
  box.getCenter( center );

  controls.target.copy( center );
  controls.update();

  // Center the airfoil
  geom.center();
  geom.translate( size.x / 2, size.y / 2, size.z / 2 );

  // add edge lines
  if ( config.drawLines ) {
    const edges = new THREE.EdgesGeometry( geom );    
    const edMat = new THREE.LineBasicMaterial( { color: new THREE.Color( config.wireframeColour ), linewidth: 1 } );
    const lines = new THREE.LineSegments( edges, edMat );
    meshGroup.add( lines );
  }

  // place camera so object fits
  const maxDim = Math.max( size.x, size.y, size.z );
  const dist = Math.max( 0.6, maxDim * 1.6 );

  grid.visible = axes.visible = config.drawGrid;
}

function createFromNacaCode(): void {
  const air = NACA( Number.parseInt(config.naca), {
    c: config.chord,
    s: config.sections,
    cs: config.spacing === 'linear' ? 0 : 1,
  } );

  const pe = [];
  const pi = [];

  for ( let i = 0; i < air.x_e.length; i++ ) {
    pe.push( new THREE.Vector2( air.x_e[i], air.y_e[i] ) );
    pi.push( new THREE.Vector2( air.x_i[i], air.y_i[i] ) );
  }
  
  pi.reverse(); // inner points need to go from TE to LE

  createFromPoints( pe.concat( pi ) );
}

async function createFromNacaDat( nacaDat: string ): Promise<void> {
  createFromPoints( await load( nacaDat ) );
}

function create(): void {
  if ( config.createFromDat && config.nacaDat ) {
    createFromNacaDat( config.nacaDat );
  } else {
    createFromNacaCode();
  }
}

loadGuiState();

create();

function animate(): void {
  renderer.render( scene, camera );
}

function exportOBJ(): void {
  const filename = config.createFromDat ? config.nacaDat.replace( '.dat', '.obj' ) : `naca${config.naca}.obj`;
  save( createOBJBlobURL(), filename );
}

function viewOBJ(): void {
  window.open( createOBJBlobURL(), '_blank' );
}

function createOBJBlobURL(): string  {
  const exporter = new OBJExporter();
  const result = exporter.parse( scene );

  const blob = new Blob( [ result ], { type: 'text/plain' } );

  return URL.createObjectURL( blob );
}

function save( url: string, filename: string ): void {
  const link = document.createElement( 'a' );
  link.href = url;
  link.download = filename;
  link.click();
}

function screenshot(): void {
  renderer.render( scene, camera );

  renderer.domElement.toBlob( ( blob ) => {
    if ( !blob ) {
      console.error( 'Failed to capture screenshot: Blob is null' );
      return;
    }

    const url = URL.createObjectURL( blob );

    window.open( url, '_blank' );
  }, 'image/png' );
}

function exportDAT(): void {
  let datContent = 'Generated by NACA Airfoil Generator\n' + 
    'NACA code: ' + config.naca + '\n';

  const air = NACA( Number.parseInt(config.naca), {
      c: config.chord,
      s: config.sections,
      cs: config.spacing === 'linear' ? 0 : 1,
    } );

  air.x_i.reverse();
  air.y_i.reverse();

  for ( let i = 0; i < air.x_i.length; i++ ) {
    datContent += `${air.x_i[i].toFixed(6)} ${air.y_i[i].toFixed(6)}\n`;
  }

  for ( let i = 0; i < air.x_e.length; i++ ) {
    datContent += `${air.x_e[i].toFixed(6)} ${air.y_e[i].toFixed(6)}\n`;
  }

  const blob = new Blob( [ datContent ], { type: 'text/plain' } );
  const url = URL.createObjectURL( blob );

  window.open( url, '_blank' );
}
