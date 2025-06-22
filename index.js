
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// @ts-ignore
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { AnimationQueue } from './animationQueue.js';
import { RubixLighting } from './lighting.js';

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(8, 8, 8);
controls.minDistance = 3.0
controls.maxDistance = 40.0
controls.update();
controls.mouseButtons.RIGHT = null;

const lights = new RubixLighting();
lights.bind(scene);


const loader = new GLTFLoader();
let cubeTemplate;

loader.load('./cube-bevelled.glb', (gltf) => {
    cubeTemplate = gltf.scene;
    console.log("hey", gltf.scene);
    initRubiksCube(); // call your setup function once model is ready
});

const PIECE_MATERIAL = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: .5,
    roughness: .1,
    clearcoat: .1,
    reflectivity: .5
})

// Create 27 small cubes (size: 1 unit) in 3×3×3
const group = new THREE.Group();
const rotationGroup = new THREE.Group();



function initRubiksCube() {
    const cubeSize = 2;
    const offset = (3 * cubeSize) / 2 - cubeSize / 2;

    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                const pieceGeometry = cubeTemplate.clone(true);
                const pieceGeometryWithColors = pieceGeometry.children[0].geometry.clone().toNonIndexed();

                const normalAttr = pieceGeometryWithColors.getAttribute("normal");
                const colors = [];

                // Iterate through the normals and assign colors based on face orientation
                for (let normalIndex = 0; normalIndex < normalAttr.count; normalIndex += 3) {
                    let arrayIndex = normalIndex * normalAttr.itemSize;
                    const normalX = normalAttr.array[arrayIndex++]
                    const normalY = normalAttr.array[arrayIndex++]
                    const normalZ = normalAttr.array[arrayIndex++]

                    const color = lookupColorForFaceNormal([x, y, z], normalX, normalY, normalZ);

                    // Add the same color for all 3 vertices of the face
                    colors.push(color.r, color.g, color.b);
                    colors.push(color.r, color.g, color.b);
                    colors.push(color.r, color.g, color.b);
                }

                pieceGeometryWithColors.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));


                const subCube = new THREE.Mesh(pieceGeometryWithColors, PIECE_MATERIAL)

                subCube.position.set(
                    x * cubeSize - offset,
                    y * cubeSize - offset,
                    z * cubeSize - offset
                );

                group.add(subCube);
            }
        }
    }
}


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let dragStartMouse = null;
let dragStartPoint = null;
let selectedFaceNormal = null;
let selectedCube = null;

function updateMouseCoords(event, targetVec) {
    const rect = renderer.domElement.getBoundingClientRect();
    targetVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    targetVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// Helper to convert a 2D screen point into a 3D ray line
function getRayLine(mouseVec2) {
    raycaster.setFromCamera(mouseVec2, camera);
    const origin = raycaster.ray.origin.clone();
    const direction = raycaster.ray.direction.clone().multiplyScalar(100);
    return new THREE.Line3(origin, origin.clone().add(direction));
}

// Intersect ray line with plane
function planeIntersect(line, plane) {
    const result = new THREE.Vector3();
    if (!plane.intersectLine(line, result)) return null;
    return result;
}

renderer.domElement.addEventListener('mousedown', (event) => {
    updateMouseCoords(event, mouse);
    raycaster.setFromCamera(mouse, camera);
    document.body.style.cursor = 'grabbing';

    const intersects = raycaster.intersectObjects(group.children, true);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        selectedCube = intersect.object;

        // Get face normal in world space
        selectedFaceNormal = intersect.face.normal.clone();
        selectedFaceNormal.transformDirection(intersect.object.matrixWorld);

        // Project mouse to 3D point on face
        const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(selectedFaceNormal, intersect.point);
        dragStartMouse = mouse.clone(); // store normalized mouse
        const dragStartLine = getRayLine(dragStartMouse);
        dragStartPoint = planeIntersect(dragStartLine, facePlane);

        controls.enableRotate = false;
    }
});

renderer.domElement.addEventListener('mouseup', (event) => {
    if (!dragStartPoint || !selectedFaceNormal || !selectedCube) return;
    document.body.style.cursor = 'default';
    controls.enableRotate = true;

    updateMouseCoords(event, mouse);

    // Project end point on same face plane
    const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(selectedFaceNormal, dragStartPoint);
    const dragEndLine = getRayLine(mouse.clone());
    const dragEndPoint = planeIntersect(dragEndLine, facePlane);
    if (!dragEndPoint) return;

    const dragVectorRaw = dragEndPoint.clone().sub(dragStartPoint)
    const dragVector = dragVectorRaw.clone().normalize();

    const dragMagnitude = dragVectorRaw.length();

    if (dragMagnitude < 1) {
        console.log("Too short — not rotating");
        return;
    }

    // Call your rotation logic
    addRotationForTouch(selectedFaceNormal, selectedCube.position, dragVector);

    // Reset drag state
    dragStartMouse = null;
    dragStartPoint = null;
    selectedFaceNormal = null;
    selectedCube = null;
});






// Generates the color for all faces in a piece, colored if the normal of the face is very close to the normal of the face of the piece, otherwise returns a dark color for hidden faces or curves.
const lookupColorForFaceNormal = (piece, nx, ny, nz) => {
    const normal = new THREE.Vector3(nx, ny, nz).normalize();
    if (normal.distanceToSquared(new THREE.Vector3(1, 0, 0)) < 1e-12 && piece[0] === 2) return new THREE.Color('red');     // right
    if (normal.distanceToSquared(new THREE.Vector3(-1, 0, 0)) < 1e-12 && piece[0] === 0) return new THREE.Color('orange');  // left
    if (normal.distanceToSquared(new THREE.Vector3(0, 1, 0)) < 1e-12 && piece[1] === 2) return new THREE.Color('white');    // top
    if (normal.distanceToSquared(new THREE.Vector3(0, -1, 0)) < 1e-12 && piece[1] === 0) return new THREE.Color('yellow');  // bottom
    if (normal.distanceToSquared(new THREE.Vector3(0, 0, 1)) < 1e-12 && piece[2] === 2) return new THREE.Color('green');    // front
    if (normal.distanceToSquared(new THREE.Vector3(0, 0, -1)) < 1e-12 && piece[2] === 0) return new THREE.Color('blue');    // back

    return new THREE.Color(0.02, 0.02, 0.02); // inner or hidden face or curves
};

const axis = new THREE.AxesHelper(5);
scene.add(axis);
scene.add(group);
scene.add(rotationGroup);



const animationQueue = new AnimationQueue();
animationQueue.bind(group, rotationGroup);

function animate() {
    requestAnimationFrame(animate);
    animationQueue.process();
    controls.update();
    renderer.render(scene, camera);
}
animate();

shuffle();
// Handle browser resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function shuffle() {
    for (let i = 0; i < 20; i++) {
        const randomKey = Math.round(Math.random() * 10);
        addRotationForKey(randomKey, 4);
    }
}

window.addEventListener("keydown", (event) => {
    const eventKeyNum = parseInt(event.key);
    if (eventKeyNum >= 0 && eventKeyNum <= 9) {
        addRotationForKey(eventKeyNum);
    }
});

function addRotationForKey(rotationKey, speed) {
    const axisOfRotation = rotationKey < 4 ? 'x' : rotationKey < 7 ? 'z' : 'y';
    const selectionCriteria = rotationKey % 3;
    animationQueue.add({ axisOfRotation, rotationAngle: Math.PI/2, selectionCriteria, speed: speed });
}

function addRotationForTouch(normal, position, dragVector, magnitude = 1) {
    const axisEpsilon = 0.9;

    // Normalize for safety
    normal = normal.clone().normalize();

    let axisOfRotation = null;
    let selectionCriteria = null;
    let rotationAngle = null;

    // Handle +X and -X face
    if (Math.abs(normal.x) > axisEpsilon) {
        const isPositive = normal.x > 0;

        // Drag direction determines Y or Z rotation
        const horizontal = new THREE.Vector3(0, 0, 1); // local z+
        const vertical = new THREE.Vector3(0, 1, 0);   // local y+

        const dragH = dragVector.dot(horizontal);
        const dragV = dragVector.dot(vertical);

        if (Math.abs(dragH) > Math.abs(dragV)) {
            axisOfRotation = 'y';
            selectionCriteria = Math.round(position.y / 2 + 1);
            rotationAngle = (isPositive ? dragH > 0 : dragH < 0) ? - Math.PI / 2 : Math.PI / 2;
        } else {
            axisOfRotation = 'z';
            selectionCriteria = Math.round(position.z / 2 + 1);
            rotationAngle = (isPositive ? dragV > 0 : dragV < 0) ? Math.PI / 2 : - Math.PI / 2;
        }

    } else if (Math.abs(normal.y) > axisEpsilon) {
        const isPositive = normal.y > 0;

        const horizontal = new THREE.Vector3(1, 0, 0); // local x+
        const vertical = new THREE.Vector3(0, 0, 1);   // local z+

        const dragH = dragVector.dot(horizontal);
        const dragV = dragVector.dot(vertical);

        if (Math.abs(dragH) > Math.abs(dragV)) {
            axisOfRotation = 'z';
            selectionCriteria = Math.round(position.z / 2 + 1);
            rotationAngle = (isPositive ? dragH > 0 : dragH < 0) ? - Math.PI / 2 : Math.PI / 2;
        } else {
            axisOfRotation = 'x';
            selectionCriteria = Math.round(position.x / 2 + 1);
            rotationAngle = (isPositive ? dragV > 0 : dragV < 0) ? Math.PI / 2 : - Math.PI / 2;
        }

    } else if (Math.abs(normal.z) > axisEpsilon) {
        const isPositive = normal.z > 0;

        const horizontal = new THREE.Vector3(1, 0, 0); // local x+
        const vertical = new THREE.Vector3(0, 1, 0);   // local y+

        const dragH = dragVector.dot(horizontal);
        const dragV = dragVector.dot(vertical);

        if (Math.abs(dragH) > Math.abs(dragV)) {
            axisOfRotation = 'y';
            selectionCriteria = Math.round(position.y / 2 + 1);
            rotationAngle = (isPositive ? dragH > 0 : dragH < 0) ?  Math.PI / 2 : - Math.PI / 2;
        } else {
            axisOfRotation = 'x';
            selectionCriteria = Math.round(position.x / 2 + 1);
            rotationAngle = (isPositive ? dragV > 0 : dragV < 0) ? - Math.PI / 2 : Math.PI / 2;
        }
    }

    if (axisOfRotation && selectionCriteria != null && rotationAngle != null) {
        animationQueue.add({ axisOfRotation, rotationAngle, selectionCriteria, speed: 1 });
    } else {
        console.warn("Could not determine a valid move from drag.");
    }
}
