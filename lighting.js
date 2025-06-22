import * as THREE from 'three';

export class RubixLighting {
    constructor() {
        this.lights = [];
        this.LIGHT_COLOR = 0xffffff
        this.LIGHT_INTENSITY = 3
        this.LIGHT_DISTANCE = 4
    }
    
    bind(scene) {
        this.scene = scene;
        this.addAmbientLight();
        this.addDirectionalLights();
    }

    addAmbientLight() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 3);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
    }

    addDirectionalLights() {
        let params = [0, 0, this.LIGHT_DISTANCE]
        let params2 = [0, 0, -this.LIGHT_DISTANCE]

        //Create total 6 directional lights if initially x,y,z then the next ones are y,z,x and  y,x,z
        for (let i = 0; i < 3; i++) {
            const light = new THREE.DirectionalLight(this.LIGHT_COLOR, this.LIGHT_INTENSITY);
            let position = params.slice();
            params = params.slice(1).concat(params.slice(0, 1));
            light.position.set(position[0], position[1], position[2]);
            this.scene.add(light);
        }
        for (let i = 0; i < 3; i++) {
            const light = new THREE.DirectionalLight(this.LIGHT_COLOR, this.LIGHT_INTENSITY);
            let position = params2.slice();
            params2 = params2.slice(1).concat(params2.slice(0, 1));
            light.position.set(position[0], position[1], position[2]);
            this.scene.add(light);
        }
    }
}