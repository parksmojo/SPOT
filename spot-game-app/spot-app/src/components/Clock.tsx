import React, { useEffect, useRef, useState } from "react";
import { ServerFacade } from "./ServerFacade";
import { useIonViewWillEnter, useIonViewWillLeave } from "@ionic/react";


const Clock: React.FC = () => {
  const [endTime, setEndTime] = useState<Date | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start the clock
  useIonViewWillEnter(() => {
    clockIntervalRef.current = setInterval(() => {
      //console.log('Running interval');
      setEndTime(calcEndTime());
    }, 100);
  });

  // Stop the clock
  useIonViewWillLeave(() => {
    if (clockIntervalRef.current) {
      console.log('Clearing interval:', clockIntervalRef.current);
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  });

  // Ensures that the interval gets stopped when the clock unmounts
  useEffect(() => {
    return () => {
      if (clockIntervalRef.current) {
        console.log('Clearing interval:', clockIntervalRef.current);
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    }
  }, []);

  // Takes an input of seconds and outputs the string representation of the clock
  const formatTime = (inputSecs: number): string => {
    if (inputSecs <= 0) {
      return "00:00";
    }
    const minutes = Math.floor((inputSecs % 3600) / 60);
    const seconds = Math.floor(inputSecs % 60);
    const milliseconds = Math.floor((inputSecs - Math.floor(inputSecs)) * 1000);
  
    let formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
    // Include milliseconds if remaining time is less than 10 seconds
    if (inputSecs < 10) {
      formattedTime += `.${milliseconds.toString().padStart(3, '0')}`;
    }
    return formattedTime;
  };

  // Calculates the end time based on start time and given duration
  const calcEndTime = (): Date => {
    const startTime = ServerFacade.getStartTime();
    const start = new Date(startTime);
    const duration = ServerFacade.getPhaseDuration();
    return new Date(start.getTime() + duration * 60 * 1000);
  };

  // Returns the new time output
  if (ServerFacade.gameIsRunning() && endTime) {
    const now = new Date();
    const remainingTime = (endTime.getTime() - now.getTime()) / 1000;
    //console.log("Remaining time:", remainingTime);
    return <div>{formatTime(remainingTime)}</div>;
  } else {
    return <div>{formatTime(ServerFacade.getGameDuration() * 60)}</div>;
  }
};

export default Clock;