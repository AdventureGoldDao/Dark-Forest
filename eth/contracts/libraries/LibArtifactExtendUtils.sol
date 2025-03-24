// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Type imports
import {Biome, ArtifactType, ArtifactRarity} from "../DFTypes.sol";

library LibArtifactExtendUtils {
    function getArtifactTypeNames(ArtifactType artifactType) public pure returns (string memory) {
        if (artifactType == ArtifactType.Monolith) return "Monolith";
        else if (artifactType == ArtifactType.Colossus) return "Colossus";
        else if (artifactType == ArtifactType.Spaceship) return "Spaceship";
        else if (artifactType == ArtifactType.Pyramid) return "Pyramid";
        else if (artifactType == ArtifactType.Wormhole) return "Wormhole";
        else if (artifactType == ArtifactType.PlanetaryShield) return "Planetary Shield";
        else if (artifactType == ArtifactType.PhotoidCannon) return "Photoid Cannon";
        else if (artifactType == ArtifactType.BloomFilter) return "Bloom Filter";
        else if (artifactType == ArtifactType.BlackDomain) return "Black Domain";
        else if (artifactType == ArtifactType.IceLink) return "Ice Link";
        else if (artifactType == ArtifactType.FireLink) return "Fire Link";
        else if (artifactType == ArtifactType.Kardashev) return "Kardashev";
        else if (artifactType == ArtifactType.Bomb) return "Bomb";
        else if (artifactType == ArtifactType.StellarShield) return "Stellar Shield";
        else if (artifactType == ArtifactType.BlindBox) return "Blind Box";
        else if (artifactType == ArtifactType.Avatar) return "Avatar";
        else if (artifactType == ArtifactType.ShipMothership) return "Mothership";
        else if (artifactType == ArtifactType.ShipCrescent) return "Crescent";
        else if (artifactType == ArtifactType.ShipWhale) return "Whale";
        else if (artifactType == ArtifactType.ShipGear) return "Gear";
        else if (artifactType == ArtifactType.ShipTitan) return "Titan";
        else if (artifactType == ArtifactType.ShipPink) return "Pinkship";
        else return string(abi.encodePacked(unicode"🔷"));
    }

    function getArtifactRarityNames(ArtifactRarity rarity) public pure returns (string memory) {
        if (rarity == ArtifactRarity.Common) return "Common";
        else if (rarity == ArtifactRarity.Rare) return "Rare";
        else if (rarity == ArtifactRarity.Epic) return "Epic";
        else if (rarity == ArtifactRarity.Legendary) return "Lengendary";
        else if (rarity == ArtifactRarity.Mythic) return "Mythic";
        else return string(abi.encodePacked(unicode"🔷"));
    }

    function getBiomeNames(Biome biome) public pure returns (string memory) {
        if (biome == Biome.Ocean) return "Ocean";
        else if (biome == Biome.Forest) return "Forest";
        else if (biome == Biome.Grassland) return "Grassland";
        else if (biome == Biome.Tundra) return "Tundra";
        else if (biome == Biome.Swamp) return "Swamp";
        else if (biome == Biome.Desert) return "Desert";
        else if (biome == Biome.Ice) return "Ice";
        else if (biome == Biome.Wasteland) return "Wasteland";
        else if (biome == Biome.Lava) return "Lava";
        else if (biome == Biome.Corrupted) return "Corrupted";
        else return string(abi.encodePacked(unicode"🔷"));
    }

    // [MIT License]
    // @title Base64
    // @notice Provides a function for encoding some bytes in base64
    // @author Brecht Devos <brecht@loopring.org>
    // library LibBase64 {
    bytes internal constant TABLE =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /// @notice Encodes some bytes to the base64 representation
    function encode(bytes memory data) internal pure returns (string memory) {
        uint256 len = data.length;
        if (len == 0) return "";

        // multiply by 4/3 rounded up
        uint256 encodedLen = 4 * ((len + 2) / 3);

        // Add some extra buffer at the end
        bytes memory result = new bytes(encodedLen + 32);

        bytes memory table = TABLE;

        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)

            for {
                let i := 0
            } lt(i, len) {

            } {
                i := add(i, 3)
                let input := and(mload(add(data, i)), 0xffffff)

                let out := mload(add(tablePtr, and(shr(18, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(input, 0x3F))), 0xFF))
                out := shl(224, out)

                mstore(resultPtr, out)

                resultPtr := add(resultPtr, 4)
            }

            switch mod(len, 3)
            case 1 {
                mstore(sub(resultPtr, 2), shl(240, 0x3d3d))
            }
            case 2 {
                mstore(sub(resultPtr, 1), shl(248, 0x3d))
            }

            mstore(result, encodedLen)
        }

        return string(result);
    }

    // }

    /**
     * @dev String operations.
     */

    // library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
    // }
}
