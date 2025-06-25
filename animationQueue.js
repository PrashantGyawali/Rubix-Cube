import * as THREE from 'three';

export class AnimationQueue {

    constructor() {
        /** @type {Array<{axisOfRotation: string, rotationAngle: number, clockwise:boolean,speed: number, selectionCriteria: number}>} */
        this.queue = [];
        this.clock = new THREE.Clock(); // Internal clock
    }

    /**
     * Adds an animation to the queue.
     * @param {{axisOfRotation: string, rotationAngle: number, speed: number, selectionCriteria: number}} animation
     */
    add(animation) {
        this.queue.push({
            axisOfRotation: animation.axisOfRotation,
            rotationAngle: Math.abs(animation.rotationAngle),
            clockwise: animation.rotationAngle > 0,
            speed: animation.speed ?? 1,
            selectionCriteria: animation.selectionCriteria
        });
    }

    /**
  * Returns the first animation in the queue (private).
  * @returns {{axisOfRotation: string, rotationAngle: number, clockwise:boolean,speed: number, selectionCriteria: number}|undefined}
  */
    front() {
        return this.queue[0];
    }

    /**
     * Binds the main group and rotation group for processing animations.
     * @param group The main group containing all sub-cubes.
     * @param rotationGroup The group that will hold the sub-cubes during rotation.
     */
    bind(group, rotationGroup) {
        this.group = group;
        this.rotationGroup = rotationGroup;
    }

    process() {
        if (this.queue.length === 0) {
            this.clock.stop(); // pause time if idle
            this.clock.elapsedTime = 0;
            this.clock.start();
            return;
        }
        const deltaTime = this.clock.getDelta();
        const clearanceSpeed = Math.min(1 + (this.queue.length / 12), 6);

        const animation = this.front();
        const axis = animation.axisOfRotation;
        const layer = (animation.selectionCriteria - 1) * 2;

        if (this.rotationGroup.children.length === 0) {
            [...this.group.children].forEach((subCube) => {
                if (Math.abs(subCube.position[axis] - layer) < 0.06) {
                    this.rotationGroup.add(subCube);
                }
            });
        }

        const animateStep = () => {
            if (animation.rotationAngle <= 0) {
                [...this.rotationGroup.children].forEach((subCube) => {
                    this.group.attach(subCube);
                });
                this.rotationGroup.rotation.set(0, 0, 0);
                this.queue.shift();
                return;
            }

            animation.speed = animation.speed ?? 1;

            const rotationStep = deltaTime * animation.speed * clearanceSpeed*1.5;
            const actualStep = Math.min(rotationStep, animation.rotationAngle);

            this.rotationGroup.rotation[axis] += actualStep * (animation.clockwise ? 1 : -1);
            animation.rotationAngle -= actualStep;
        };

        animateStep();
    }
}