'''fabfile -- automate deployment of i2b2 webclient

'''

__author__ = 'Dan Connolly'
__copyright__ = '2012 University of Kansas Medical Center'
__license__ = 'MIT'
__contact__ = 'http://informatics.kumc.edu/'

from fabric.api import run, task, cd


@task
def deploy_hg_tip(localsrc='/usr/local/src/i2b2-webclient',
                  webspace='/srv/www/htdocs/',
                  i2b2path='i2b2/'):
    dest = webspace + i2b2path
    run('mkdir -p %s' % dest)
    with cd(localsrc):
        run('hg archive -p. i2b2-webclient.zip')

        # -u     update  existing  files  and  create new ones if needed.
        # -o     overwrite  existing  files  without  prompting.
        run('unzip -d %s -q -u -o i2b2-webclient.zip' % (dest,))
