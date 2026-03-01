import React, { useEffect, useState } from "react";
import tw from 'twin.macro';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import TitledGreyBox from "@/components/elements/TitledGreyBox";
import { Textarea } from "@/components/elements/Input";
import Button from "@/components/elements/Button";
import MotdDisplay from "./MotdDisplay"
import { ServerContext } from '@/state/server';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import { miniMessageToLegacy } from './minecraft-text';

const PROPERTIES_FILE = '/server.properties';

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const [lineOne, setLineOne] = useState("");
    const [lineTwo, setLineTwo] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        const loadMotd = async () => {
            try {
                const content = await getFileContents(server.uuid, PROPERTIES_FILE);
                const lines = content.split('\n');

                const inputLine = lines.find(line => line.startsWith('# motd-input:'));
                if (inputLine) {
                    const raw = inputLine.slice('# motd-input:'.length).trimStart();
                    const parts = raw.split('\\n');
                    setLineOne(parts[0] || "");
                    setLineTwo(parts[1] || "");
                } else {
                    const motdLine = lines.find(line => line.startsWith('motd='));
                    if (motdLine) {
                        const raw = motdLine.slice('motd='.length);
                        const parts = raw.split('\\n');
                        setLineOne(parts[0] || "");
                        setLineTwo(parts[1] || "");
                    }
                }
            } catch (e) {
                console.error('Failed to load server.properties:', e);
            }
        };

        loadMotd();
    }, [server.uuid]);

    const textAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const parts = newValue.split('\n');
        if (parts.length <= 2) {
            setLineOne(parts[0] ?? "");
            setLineTwo(parts[1] ?? "");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const content = await getFileContents(server.uuid, PROPERTIES_FILE);
            const lines = content.split('\n');

            const filtered = lines.filter(
                line => !line.startsWith('# motd-input:') && !line.startsWith('motd=')
            );

            const rawInput = lineTwo ? `${lineOne}\\n${lineTwo}` : lineOne;
            const legacyLineOne = miniMessageToLegacy(lineOne);
            const legacyLineTwo = lineTwo ? miniMessageToLegacy(lineTwo) : '';
            const legacyMotd = legacyLineTwo ? `${legacyLineOne}\\n${legacyLineTwo}` : legacyLineOne;
            filtered.push(`# motd-input: ${rawInput}`);
            filtered.push(`motd=${legacyMotd}`);

            await saveFileContents(server.uuid, PROPERTIES_FILE, filtered.join('\n') + '\n');
        } catch (e) {
            console.error('Failed to save server.properties:', e);
            setSaveError('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
      <ServerContentBlock title={'MOTD Editor'}>
        <div css={tw`md:flex`}>
          <div css={tw`flex-1`}>
            <TitledGreyBox title={'Editor'}>
              <Textarea value={lineOne + (lineTwo ? ("\n" + lineTwo) : "")} onChange={textAreaChange} rows={2} />
              <div css={tw`mt-4 flex items-center`}>
                <Button onClick={handleSave} isLoading={isSaving} color={'green'}>
                    Save
                </Button>
                {saveError && (
                    <p css={tw`ml-4 text-red-400 text-sm`}>{saveError}</p>
                )}
              </div>
            </TitledGreyBox>
          </div>
          <div css={tw`flex-1 lg:flex-none lg:w-1/2 mt-8 md:mt-0 md:ml-10`}>
            <TitledGreyBox title={'Preview'}>
              <div css={tw`w-full flex`}>
                <MotdDisplay title={server.name} lineOne={lineOne || ""} lineTwo={lineTwo || ""} />
              </div>
            </TitledGreyBox>
          </div>
        </div>
      </ServerContentBlock>
    );
};
