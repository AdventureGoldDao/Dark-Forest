import { TOKEN_NAME } from '@dfares/constants';
import { Planet } from '@dfares/types';
import React, { useEffect, useMemo, useState } from 'react';
import { getEnergyAtTime } from '../../Backend/GameLogic/ArrivalUtils';
import { Row } from '../Components/Row';
import { useUIManager } from '../Utils/AppHooks';
interface BuyEnergyBarProps {
  planet: Planet;
  halfPrice: boolean;
  energyPurchaseFee: number;
  balanceEth: number;
  onDurationChange: (duration: number) => void; // Callback for output
}

const BuyEnergyBar: React.FC<BuyEnergyBarProps> = ({
  planet,
  halfPrice,
  energyPurchaseFee,
  balanceEth,
  onDurationChange,
}) => {
  const uiManager = useUIManager();
  const [selectedDuration, setSelectedDuration] = useState<number>(0);

  const aimPlanetEnergy = getEnergyAtTime(planet, selectedDuration * 1000 + Date.now());

  const baseFeePreSecond = 0.00001;

  const steps = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.99];

  const energyLevels = useMemo(() => {
    return steps.map((percent) => {
      const leftTimestamp = Math.floor(Date.now() / 1000);
      const rightTimestamp = Math.ceil(uiManager.getEnergyCurveAtPercent(planet, percent));
      const duration =
        rightTimestamp - leftTimestamp > 0
          ? Math.ceil(1000 * (rightTimestamp - leftTimestamp)) / 1000
          : 0;
      const ethCost = halfPrice
        ? (0.5 * Math.round(100000 * baseFeePreSecond * duration)) / 100000
        : Math.round(100000 * baseFeePreSecond * duration) / 100000;
      return { percent, leftTimestamp, rightTimestamp, duration, ethCost };
    });
  }, [planet]);

  const durationNeedForFull = Math.ceil(energyLevels[energyLevels.length - 1].duration);

  // Trigger the callback whenever the slider value changes
  useEffect(() => {
    onDurationChange(selectedDuration);
  }, [selectedDuration, onDurationChange]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setSelectedDuration(value);
  };

  return (
    <div className='energy-bar-container'>
      <div>
        <div> Energy: {planet.energy} </div>
        <div> Energy Cap: {planet.energyCap} </div>
        {energyLevels.map(({ percent, leftTimestamp, rightTimestamp, duration, ethCost }) => (
          <div key={percent}>
            need {duration.toFixed(3)} seconds (cost {ethCost} {TOKEN_NAME}) to reach {percent}%
            energy
          </div>
        ))}
      </div>

      <div className='slider-container'>
        <Row>
          <label htmlFor='blockPeriodSlider'>Set duration for Purchase:</label>
          <input
            type='range'
            id='blockPeriodSlider'
            min='0'
            max={durationNeedForFull}
            value={selectedDuration}
            onChange={handleSliderChange}
          />
        </Row>
        <Row>
          To Purchase: {selectedDuration} seconds for {energyPurchaseFee} ${TOKEN_NAME}
        </Row>
        This planet Energy will be {aimPlanetEnergy} !<Row></Row>
      </div>
    </div>
  );
};

export default BuyEnergyBar;
