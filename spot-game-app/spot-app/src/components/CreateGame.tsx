import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar,IonFabButton, IonButtons, IonItem, IonInput, IonList, IonSelect, IonSelectOption, IonAlert, IonPage, IonCard, IonRange, IonText } from '@ionic/react';
import { useState } from 'react'
import { ServerFacade } from './ServerFacade';
import { GameVals as gv } from './GameVals';
import { CirclePicker } from 'react-color';


const CreateGame = ({ dismiss }: { dismiss: (data?: string | null | undefined | number, role?: string) => void }) => {
  // Error pop-up variables
  const [iserror, setIsError] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  // All game input variables
  const [gameName, setGameName] = useState<string>('');
  const [gameDuration, setDuration] = useState<number>(0);
  const [gameType, setGameType] = useState(null);
  const [bounding, setBoundingBox] = useState(null);

  // Game specific input variables
  const [difficulty, setDifficulty] = useState<number>(0);
  const [dropPhase, setDropPhase] = useState<number>(0);
  const [collectPhase, setCollectPhase] = useState<number>(0);
  const [cameraAmount, setCameraAmout] = useState<number | { lower: number; upper: number }>(0);
  const [cameraRange, setCameraRange] = useState<number | { lower: number; upper: number }>(0);
  const [cameraDuration, setCameraDuration] = useState<number | { lower: number; upper: number }>(0);
  const [capturesToWin, setCapturesToWin] = useState<number>(0);
  const [displayTeamAColorPicker, openTeamAColorPicker] = useState(false);
  const [teamAColor, setTeamAColor] = useState<string | null>(null);
  const [displayTeamBColorPicker, openTeamBColorPicker] = useState(false);
  const [teamBColor, setTeamBColor] = useState<string | null>(null);
  
  const pickTeamAColor = (color: any) => {
    console.log("Color picked", color.hex);
    setTeamAColor(color.hex);
  }
  const showTeamAColorPicker = () => {
    openTeamAColorPicker(!displayTeamAColorPicker);
  }

  const pickTeamBColor = (color: any) => {
    console.log("Color picked", color.hex);
    setTeamBColor(color.hex);
  }
  const showTeamBColorPicker = () => {
    openTeamBColorPicker(!displayTeamBColorPicker);
  }


  // Checking if each field has been filled/selected (starts as false)
  const isFormFilled = () => {
    // Checks all game inputs
    let isFilled = gameName !== '' && gameType && bounding;
    if (gameType === 1) { // Checks KoTH inputs
      isFilled = isFilled && gameDuration;
    } else if (gameType === 2) { // Checks DD inputs
      isFilled = isFilled && dropPhase && collectPhase && cameraAmount && cameraRange;
    }
    return isFilled;
  };

  // Makes sure that the name isnt taken by another open game
  function checkUniqueName(name: string) {
    const gameList = ServerFacade.getGameList();
    if(gameList){
      for (let game of gameList) {
        if (name === game.game_name) {
          return false;
        }
      }
    }
    return true;
  }

  const handleCreateGame = async () => {
    try {
      if (!checkUniqueName(gameName)) {
        throw new Error("Game name is already taken by other open game");
      }
      // Creates a local variable so that it can send the request before re-rendering
      let duration = gameDuration;
      let config = {};
      if (gameType === gv.DEAD_DROP) {
        duration = dropPhase + collectPhase;
        config = { dropPhase, collectPhase, cameraAmount, cameraRange, cameraDuration};
      } else if (gameType === gv.CAPTURE_THE_FLAG){
        config = {teamAColor,teamBColor, capturesToWin};
      }
      
      // Makes the request
      await ServerFacade.createGame(gameName, gameType, duration, config, bounding);
      // Dismissing the create game screen
      dismiss(null, 'confirm')
    } catch (error: any) {
      // An error is caught and displayed here.
      setIsError(true);
      setMessage(error.message);
    }
  }

  const handleDifficulty = (diff:number) => {
    switch(diff){
      case 1:
        setCameraAmout(gv.DD_EZ_CAMERA_AMOUNT);
        setCameraRange(gv.DD_EZ_CAMERA_RANGE);
        setCameraDuration(gv.DD_EZ_CAMERA_DURATION);
        break;
      case 2:
        setCameraAmout(gv.DD_MED_CAMERA_AMOUNT);
        setCameraRange(gv.DD_MED_CAMERA_RANGE);
        setCameraDuration(gv.DD_MED_CAMERA_DURATION);
        break;
      case 3:
        setCameraAmout(gv.DD_HARD_CAMERA_AMOUNT);
        setCameraRange(gv.DD_HARD_CAMERA_RANGE);
        setCameraDuration(gv.DD_HARD_CAMERA_DURATION);
        break;
      case 4:
        setCameraAmout(0);
        setCameraRange({lower:gv.DD_CAMERA_RANGE_MIN,upper:100});
        setCameraDuration({lower:gv.DD_CAMERA_DURATION_MIN,upper:gv.DD_CAMERA_DURATION_MAX});
        break;
      default:
        throw new Error("Something went wrong with the difficulty settings. Try again later.");
    }
    setDifficulty(diff);
  }

  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          {/* Cancel Button */}
          <IonButtons slot="start">
            <IonButton onClick={() => dismiss(null, 'cancel')} color={'danger'}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Create Game</IonTitle>
          {/* Confirm Button */}
          <IonButtons slot="end">
            <IonButton strong={true} onClick={handleCreateGame} color={'success'} disabled={!isFormFilled()}>
              Confirm
            </IonButton>
          </IonButtons>
          <IonAlert
            isOpen={iserror}
            onDidDismiss={() => setIsError(false)}
            header="Error"
            message={message}
            buttons={['Dismiss']}
          ></IonAlert>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
        {/* Game Name */}
        <IonItem>
          <IonInput
            label="Game Name"
            labelPlacement="stacked"
            type="text"
            placeholder="New Game"
            onIonInput={(e) => setGameName(e.detail.value!.trim())}
          />
        </IonItem>

        {/* Bounding Box */}
        <IonItem>
          <IonSelect aria-label="Bounding Box" interface="popover" placeholder="Select Play Area" onIonChange={(e) => setBoundingBox(e.detail.value!)}>
            <IonSelectOption value={'reston-center'}>Reston Town Center</IonSelectOption>
            <IonSelectOption value={'office'}>Internship Office</IonSelectOption>
            <IonSelectOption value={'dan-house'}>Dan's House</IonSelectOption>
            <IonSelectOption value={'reston-center'} disabled={true}>Coming soon!</IonSelectOption>
          </IonSelect>
        </IonItem>

        {/* Game Type */}
        <IonItem>
          <IonSelect aria-label="Scenarios" interface="popover" placeholder="Select Game Type" onIonChange={(e) => setGameType(e.detail.value!)}>
            <IonSelectOption value={gv.KING_OF_THE_HILL}>King of the Hill</IonSelectOption>
            <IonSelectOption value={gv.DEAD_DROP}>Dead Drop</IonSelectOption>
            <IonSelectOption value={gv.CHASE_THE_RABBIT}>Chase the Rabbit</IonSelectOption>
            <IonSelectOption value={gv.CAPTURE_THE_FLAG}>Capture the Flag</IonSelectOption>
            <IonSelectOption value={gv.LAST_INTERN_STANDING} disabled={true}>Last Intern Standing</IonSelectOption>
          </IonSelect>
        </IonItem>

        {/* Game Specific Settings */}
        {gameType && gameType !== 2 ?
          <IonItem>
            <IonInput
              label="Set Game Duration (minutes)"
              labelPlacement="stacked"
              type="number"
              placeholder="15"
              onIonInput={(e) => setDuration(parseFloat(e.detail.value!))}
            ></IonInput>
          </IonItem>
          : null}

        {gameType === 2 ?
          <>
            <IonItem>
              <IonInput
                label="Drop Phase (minutes)"
                labelPlacement="stacked"
                type="number"
                style={{ width: 140 }}
                onIonInput={(e) => setDropPhase(parseFloat(e.detail.value!))}
              ></IonInput>
              <IonInput
                label="Collect Phase (minutes)"
                labelPlacement="stacked"
                type="number"
                onIonInput={(e) => setCollectPhase(parseFloat(e.detail.value!))}
              ></IonInput>
            </IonItem>
            <IonItem>
              <IonSelect aria-label="Difficulty" interface="popover" placeholder="Select Difficulty" onIonChange={(e) => handleDifficulty(e.detail.value!)}>
                <IonSelectOption value={1}>Easy</IonSelectOption>
                <IonSelectOption value={2}>Medium</IonSelectOption>
                <IonSelectOption value={3}>Hard</IonSelectOption>
                <IonSelectOption value={4}>Custom</IonSelectOption>
              </IonSelect>
            </IonItem>
            {difficulty !== 0 ?
              <>
                <IonItem>
                  <IonRange aria-label="Camera Amount"
                    ticks={true}
                    snaps={true}
                    min={gv.DD_CAMERA_AMOUNT_MIN}
                    max={gv.DD_CAMERA_AMOUNT_MAX}
                    step={2}
                    value={cameraAmount}
                    disabled={difficulty !== 4}
                    onIonChange={({ detail }) => setCameraAmout(detail.value)}>
                    <div slot="label">Camera<br />Amount</div>
                  </IonRange>
                </IonItem>
                <IonItem>
                  <IonRange aria-label="Camera Range"
                    dualKnobs={true}
                    min={gv.DD_CAMERA_RANGE_MIN}
                    disabled={difficulty !== 4}
                    value={cameraRange}
                    onIonChange={({ detail }) => setCameraRange(detail.value)}>
                    <div slot="label">Camera<br />Range</div>
                  </IonRange>
                </IonItem>
                <IonItem>
                  <IonRange aria-label="Camera Duration"
                    dualKnobs={true}
                    min={gv.DD_CAMERA_DURATION_MIN}
                    max={gv.DD_CAMERA_DURATION_MAX}
                    disabled={difficulty !== 4}
                    pin={true}
                    value={cameraDuration}
                    pinFormatter={(value: number) => `${value}s`}
                    onIonChange={({ detail }) => setCameraDuration(detail.value)}>
                    <div slot="label">Camera<br />Duration</div>
                  </IonRange>
                </IonItem>
              </>
              : null}
          </>
          : null}
          {gameType === gv.CAPTURE_THE_FLAG ? <>
            <IonButton className='color-button' onClick={showTeamAColorPicker} color={"light"} ></IonButton>
            <IonButton className='color-button' onClick={showTeamBColorPicker} color={"light"} ></IonButton>
          </> : null}
          {gameType === gv.CAPTURE_THE_FLAG ? <>
            <IonItem>
            <IonInput
              label="Captures to Win"
              labelPlacement="stacked"
              type="number"
              onIonInput={(e) => setCapturesToWin(parseFloat(e.detail.value!))}
            ></IonInput>
            </IonItem>
          </> : null}
          {displayTeamAColorPicker ?
            <IonCard className='color-card'>
              <CirclePicker className='color-picker' circleSpacing={8} width="130px" onChangeComplete={pickTeamAColor}></CirclePicker>
            </IonCard>
            : null}
           {displayTeamBColorPicker ?
            <IonCard className='color-card'>
              <CirclePicker className='color-picker' circleSpacing={8} width="130px" onChangeComplete={pickTeamBColor}></CirclePicker>
            </IonCard>
            : null}
        </IonCard>          
      </IonContent>
    </IonPage>
  );
}
export default CreateGame;