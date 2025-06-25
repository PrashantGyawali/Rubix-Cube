import * as THREE from 'three';

export class TouchInput {
    constructor(rendererDomElement) {
        this.rendererDomElement = rendererDomElement;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.dragStartMouse = null;
        this.dragStartPoint = null;
        this.selectedFaceNormal = null;
        this.selectedCube = null;

        // To be set via bind methods
        this.camera = null;
        this.group = null;
        this.controls = null;
        this.addRotation = null;
    }

    bindCamera(camera) {
        this.camera = camera;
    }
    bindGroup(group) {
        this.group = group;
    }
    bindControls(controls) {
        this.controls = controls;
    }
    bindRotationHandler(callback) {
        this.addRotation = callback;
    }

    updateMouseCoords(event, targetVec) {
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const rect = this.rendererDomElement.getBoundingClientRect();
        targetVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        targetVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    getRayLine(mouseVec2) {
        this.raycaster.setFromCamera(mouseVec2, this.camera);
        const origin = this.raycaster.ray.origin.clone();
        const direction = this.raycaster.ray.direction.clone().multiplyScalar(100);
        return new THREE.Line3(origin, origin.clone().add(direction));
    }

    planeIntersect(line, plane) {
        const result = new THREE.Vector3();
        return plane.intersectLine(line, result) ? result : null;
    }

    onStart(event) {
        if (!this.camera || !this.group || !this.controls) return;

        this.updateMouseCoords(event, this.mouse);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        document.body.style.cursor = 'grabbing';

        const intersects = this.raycaster.intersectObjects(this.group.children, true);
        if (intersects.length > 0) {
            const intersect = intersects[0];
            this.selectedCube = intersect.object;
            this.selectedFaceNormal = intersect.face.normal.clone();
            this.selectedFaceNormal.transformDirection(intersect.object.matrixWorld);

            const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.selectedFaceNormal, intersect.point);
            this.dragStartMouse = this.mouse.clone();
            const dragStartLine = this.getRayLine(this.dragStartMouse);
            this.dragStartPoint = this.planeIntersect(dragStartLine, facePlane);

            this.controls.enableRotate = false;
        }
    }

    onEnd(event) {
        if (!this.dragStartPoint || !this.selectedFaceNormal || !this.selectedCube || !this.controls || !this.addRotation)
            return;

        document.body.style.cursor = 'default';
        this.controls.enableRotate = true;

        const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
        const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
        this.updateMouseCoords({ clientX, clientY }, this.mouse);

        const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.selectedFaceNormal, this.dragStartPoint);
        const dragEndLine = this.getRayLine(this.mouse.clone());
        const dragEndPoint = this.planeIntersect(dragEndLine, facePlane);
        if (!dragEndPoint) return;

        const dragVectorRaw = dragEndPoint.clone().sub(this.dragStartPoint);
        const dragVector = dragVectorRaw.clone().normalize();
        const dragMagnitude = dragVectorRaw.length();

        if (dragMagnitude < 1) {
            console.log("Too short — not rotating");
            return;
        }

        this.addRotation(this.selectedFaceNormal, this.selectedCube.position, dragVector);

        this.dragStartMouse = null;
        this.dragStartPoint = null;
        this.selectedFaceNormal = null;
        this.selectedCube = null;
    }

    addListeners() {
        this.rendererDomElement.addEventListener("touchstart", (e) => this.onStart(e), { passive: false });
        this.rendererDomElement.addEventListener("touchend", (e) => this.onEnd(e), { passive: false });
        this.rendererDomElement.addEventListener("mousedown", (e) => this.onStart(e));
        this.rendererDomElement.addEventListener("mouseup", (e) => this.onEnd(e));
    }
}
