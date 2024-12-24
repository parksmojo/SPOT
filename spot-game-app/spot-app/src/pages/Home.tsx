import { IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonPage, IonTitle, IonToolbar, IonAlert } from '@ionic/react';
import React, { useState, useRef, useEffect } from 'react'
import './Home.css';
import { useHistory } from 'react-router-dom';
import { ServerFacade } from '../components/ServerFacade';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const Home: React.FC = () => {
  async function lockOrientation() {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  }

  const history = useHistory();

  ServerFacade.EndPriorSession();

  const inputName = useRef<HTMLIonInputElement>(null);
  const inputDevice = useRef<HTMLIonInputElement>(null);
  const [iserror, setIsError] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  async function handleLogin() {
    // Double checks that there were values input
    if (!inputName.current?.value || !inputDevice.current?.value) {
      setIsError(true);
      setMessage("Please enter a value");
      return;
    }
    try {
      // Makes the request and goes to next page
      await ServerFacade.login(inputName.current?.value.toString().trim(), inputDevice.current?.value.toString().trim());
      history.push('/menu');
    } catch (error: any) {
      // An error is caught and displayed here.
      setIsError(true);
      setMessage(error.message);
    }
  };

  lockOrientation();
  return (
    <>
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Welcome to SPOT</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <IonHeader collapse="condense">
            <IonToolbar>
              <IonTitle size="large">Blank</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonInput
            label='Username'
            labelPlacement='floating'
            ref={inputName}
            type='text'>
          </IonInput>
          <IonInput
            label='Device ID'
            labelPlacement='floating'
            ref={inputDevice}
            type='text'>
          </IonInput>
          <IonButton expand='block' color='dark' onClick={handleLogin}>Login</IonButton>
          <IonAlert
            isOpen={iserror}
            onDidDismiss={() => setIsError(false)}
            header="Error"
            message={message}
            buttons={['Dismiss']}
          ></IonAlert>
        </IonContent>
      </IonPage>
    </>
  );
};

export default Home;
