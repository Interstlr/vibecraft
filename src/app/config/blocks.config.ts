
export interface ProceduralConfig {
    type: 'noise' | 'wood_side' | 'workbench' | 'color' | 'flat';
    color1: string;
    color2?: string;
}

export interface BlockFaceDefinition {
    texture?: string;
    procedural?: ProceduralConfig;
}

export interface BlockDefinition {
    // Default for all faces
    texture?: string;
    procedural?: ProceduralConfig;

    // Overrides
    faces?: {
        top?: BlockFaceDefinition;
        bottom?: BlockFaceDefinition;
        side?: BlockFaceDefinition; // Right, Left, Front, Back
        right?: BlockFaceDefinition;
        left?: BlockFaceDefinition;
        front?: BlockFaceDefinition;
        back?: BlockFaceDefinition;
    };

    transparent?: boolean;
    isTool?: boolean;
}

export const BLOCKS: Record<string, BlockDefinition> = {
    grass: {
        faces: {
            side: {
                texture: 'assets/textures/grass-side.webp',
            },
            top: {
                texture: 'assets/textures/grass-top.webp',
            },
            bottom: {
                texture: 'assets/textures/dirt.png',
            }
        }
    },
    dirt: {
        faces: {
            side: {
                texture: 'assets/textures/dirt.png',
            },
            top: {
                texture: 'assets/textures/dirt.png',
            },
            bottom: {
                texture: 'assets/textures/dirt.png',
            }
        }
    },
    water: {
        procedural: {
            type: 'flat',
            color1: '#4FC3F7'
        },
        transparent: true
    },
    stone: {
        procedural: {
            type: 'noise',
            color1: '#9e9e9e',
            color2: '#757575'
        }
    },
    wood: {
        // Top/Bottom defaults
        // procedural: {
        //     type: 'wood_side', // Actually the top of wood is usually concentric rings but we use side pattern for simplicity in original or specific colors
        //     color1: '#8D6E63',
        //     color2: '#6D4C41'
        // },
        faces: {
            side: {
                texture: 'assets/textures/oak-side.png',
            },
            top: {
                texture: 'assets/textures/oak-top.webp',
            },
            bottom: {
                texture: 'assets/textures/oak-top.webp',
            }
        },
    },
    leaves: {
        faces: {
            side: {
                texture: 'assets/textures/leaves.webp',
            },
            top: {
                texture: 'assets/textures/leaves.webp',
            },
            bottom: {
                texture: 'assets/textures/leaves.webp',
            }
        },
        transparent: true
    },
    workbench: {
        procedural: {
            type: 'workbench',
            color1: '#D2691E',
            color2: '#A0522D'
        }
    },
    axe: {
        procedural: {
            type: 'flat',
            color1: '#FF0000'
        },
        isTool: true
    },
    hover: {
        procedural: {
            type: 'flat',
            color1: '#000000'
        },
        isTool: true
    }
};
